extends ScreenBase
## Play: board, tape, commands, and controls for one level.
##
## The simulation runs first and in one call (PlaySession.start). This screen then replays the
## resulting events with short animations. Animation length never changes the outcome, and with
## Reduce motion the tape and automaton jump instead of sliding.

const NUDGE_SECONDS := 0.08
const COMMANDS: Array[Dictionary] = [
	{"op": "MOVE_FORWARD", "label": "MOVE", "icon": "move"},
	{"op": "TURN_LEFT", "label": "LEFT", "icon": "left"},
	{"op": "TURN_RIGHT", "label": "RIGHT", "icon": "right"},
	{"op": "REPEAT", "label": "REPEAT", "icon": "repeat"},
]

## False in debug screenshots, which must not write progress.
var persist := true

var _entry: Dictionary
var _level: Dictionary
var _session: PlaySession
var _tape: TapeModel
## Bumped whenever a run is stopped, so an animation that was waiting ends quietly.
var _run_id := 0
## True while one step is being animated.
var _busy := false

## The size the objective message should have inside its row.
var _message_box := Vector2.ZERO
var _back: TileButton
var _help: TileButton
var _menu: TileButton
var _coach: _Coach
## The open pause or hint panel, if any.
var _overlay: Control
var _caption: Label
var _title: Label
var _badge: _Badge
var _message: Label
var _counter: Label
var _board: BoardView
var _program_caption: Label
var _tools: Array[TileButton] = []
var _tape_view: TapeView
var _commands_caption: Label
var _command_buttons: Array[TileButton] = []
var _repeat_button: TileButton
var _stats: Array[_Stat] = []
var _step: TileButton
var _run: TileButton
var _reset: TileButton
var _edit: TileButton
var _levels: TileButton
var _replay: TileButton
var _next: TileButton


func _build() -> void:
	_entry = app.campaign.entry_by_id(str(args.get("level_id", "")))
	if _entry.is_empty():
		navigate.emit.call_deferred("worlds", {})
		return
	_level = _entry["level"]
	_session = PlaySession.new(_level)
	var available: Array[String] = []
	for op: String in _level["availableCommands"]:
		available.append(op)
	_tape = TapeModel.new(int(_level["constraints"]["maxCommands"]), available)
	if persist:
		app.progress.set_last_level(_entry["id"])
		app.progress.save()

	_back = TileButton.make(TileButton.Kind.SECONDARY, "", "back")
	_back.accessibility_name = "Back to levels"
	_back.pressed.connect(go_back)
	add_child(_back)
	_caption = UiKit.label("LEVEL %02d" % _entry["number"], 14, Palette.MUTE, 3)
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_caption)
	_title = UiKit.label(str(_level["title"]).to_upper(), 24, Palette.INK, 1)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	add_child(_title)
	_help = TileButton.make(TileButton.Kind.SECONDARY, "", "help")
	_help.accessibility_name = "Hint"
	_help.pressed.connect(_open_hint)
	add_child(_help)
	_menu = TileButton.make(TileButton.Kind.SECONDARY, "", "menu")
	_menu.accessibility_name = "Pause menu"
	_menu.pressed.connect(_open_pause)
	add_child(_menu)
	_coach = _Coach.new()
	add_child(_coach)

	_badge = _Badge.new()
	add_child(_badge)
	_message = UiKit.label("", 18, Palette.INK, 1)
	_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_message.add_theme_constant_override("line_spacing", -4)
	_message.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(_message)
	_counter = UiKit.label("", 18, Palette.MUTE, 1)
	_counter.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_counter.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(_counter)

	_board = BoardView.new()
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	_board.set_level(_level)

	_program_caption = UiKit.label("PROGRAM", 14, Palette.MUTE, 3)
	_program_caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(_program_caption)
	for tool in [
		["minus", "Fewer rounds"],
		["plus", "More rounds"],
		["prev", "Move earlier"],
		["next", "Move later"],
		["x", "Remove"],
	]:
		var button := TileButton.make(TileButton.Kind.SECONDARY, "", tool[0])
		button.accessibility_name = tool[1]
		button.pressed.connect(_on_tool.bind(tool[0]))
		add_child(button)
		_tools.append(button)

	_tape_view = TapeView.new()
	_tape_view.accessibility_name = "Program"
	_tape_view.tile_tapped.connect(_on_tile_tapped)
	add_child(_tape_view)

	_commands_caption = UiKit.label("COMMANDS", 14, Palette.MUTE, 3)
	add_child(_commands_caption)
	var offered := 0
	for command in COMMANDS:
		if available.has(command["op"]):
			offered += 1
	for command in COMMANDS:
		if not available.has(command["op"]):
			continue
		# Four tiles share a row, so their labels are a little smaller.
		var button := TileButton.make(
			TileButton.Kind.SECONDARY, command["label"], command["icon"], 20 if offered < 4 else 14
		)
		button.pressed.connect(_on_command.bind(command["op"]))
		add_child(button)
		_command_buttons.append(button)
		if command["op"] == TapeModel.REPEAT:
			_repeat_button = button

	for caption in ["COMMANDS", "STEPS", "BEST"]:
		var stat := _Stat.new()
		stat.caption = caption
		add_child(stat)
		_stats.append(stat)

	_step = _make_button(TileButton.Kind.SECONDARY, "STEP", "step", _on_step)
	_run = _make_button(TileButton.Kind.PRIMARY, "RUN", "play", _on_run)
	_reset = _make_button(TileButton.Kind.SECONDARY, "RESET", "reset", _on_reset)
	_edit = _make_button(TileButton.Kind.PRIMARY, "EDIT PROGRAM", "", _on_reset)
	_levels = _make_button(TileButton.Kind.SECONDARY, "LEVELS", "", go_back)
	_replay = _make_button(TileButton.Kind.SECONDARY, "REPLAY", "reset", _on_reset)
	_next = _make_button(TileButton.Kind.PRIMARY, "NEXT", "", _on_next)
	_refresh()


func go_back() -> void:
	if _overlay != null:
		_close_overlay()
		return
	_run_id += 1
	navigate.emit("world", {"world": int(_entry["world"])})


func _notification(what: int) -> void:
	# Animation pauses when the app loses focus.
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		if _session != null and _session.state == PlaySession.State.RUNNING:
			_session.pause()
			_refresh()


func _make_button(
	kind: TileButton.Kind, label: String, icon: String, handler: Callable
) -> TileButton:
	var button := TileButton.make(kind, label, icon, 20 if kind != TileButton.Kind.PRIMARY else 24)
	button.pressed.connect(handler)
	add_child(button)
	return button


# ----- layout ---------------------------------------------------------------------------------


func _layout() -> void:
	if _next == null:
		return
	var m := margin()
	var compact := size.y < 760.0
	var control_h := 48.0 if compact else 56.0
	var width := size.x - 2.0 * m
	var y := inset_top() + (12.0 if compact else 28.0)

	_back.position = Vector2(m, y)
	_back.size = Vector2(44.0, 44.0)
	_menu.position = Vector2(size.x - m - 44.0, y)
	_menu.size = Vector2(44.0, 44.0)
	_help.position = Vector2(size.x - m - 96.0, y)
	_help.size = Vector2(44.0, 44.0)
	_caption.position = Vector2(m + 54.0, y)
	_caption.size = Vector2(width - 158.0, 18.0)
	_title.position = Vector2(m + 54.0, y + 16.0)
	_title.size = Vector2(width - 158.0, 30.0)
	y += 44.0 + (10.0 if compact else 12.0)

	var objective_h := 52.0 if compact else 54.0
	var finished := _session.is_finished()
	var counter_w := 0.0 if finished else 150.0
	var badge_w := 40.0 if finished else 0.0
	_badge.visible = finished
	_badge.position = Vector2(m, y + (objective_h - 28.0) / 2.0)
	_badge.size = Vector2(28.0, 28.0)
	_message.position = Vector2(m + badge_w, y)
	_message_box = Vector2(
		width - badge_w - counter_w - (8.0 if counter_w > 0.0 else 0.0), objective_h
	)
	_message.size = _message_box
	_settle_message()
	_counter.position = Vector2(size.x - m - 150.0, y)
	_counter.size = Vector2(150.0, objective_h)
	y += objective_h + 8.0

	var bottom := size.y - inset_bottom() - m
	var controls_y := bottom - control_h
	var row_y := controls_y - 10.0 - control_h
	var cursor := row_y - (10.0 if compact else 6.0)
	if not compact:
		_commands_caption.position = Vector2(m, cursor - 18.0)
		_commands_caption.size = Vector2(width, 18.0)
		cursor -= 18.0 + 14.0
	var coach_h := 40.0
	if _coach.visible:
		_coach.position = Vector2(m, cursor - coach_h)
		_coach.size = Vector2(width, coach_h)
		cursor -= coach_h + 8.0
	var tape_h := 84.0 if compact else 112.0
	_tape_view.position = Vector2(m, cursor - tape_h)
	_tape_view.size = Vector2(width, tape_h)
	cursor = _tape_view.position.y - 6.0
	var caption_h := 40.0 if compact else 44.0
	_program_caption.position = Vector2(m, cursor - caption_h)
	_program_caption.size = Vector2(width * 0.4, caption_h)
	var tool_size := caption_h - 4.0
	var shown: Array[TileButton] = []
	for tool in _tools:
		if tool.visible:
			shown.append(tool)
	for i in shown.size():
		shown[i].size = Vector2(tool_size, tool_size)
		shown[i].position = Vector2(
			size.x - m - (shown.size() - i) * (tool_size + 8.0) + 8.0, cursor - caption_h + 2.0
		)
	cursor = _program_caption.position.y - 4.0

	var board_h := cursor - y
	var side := minf(width, board_h)
	_board.size = Vector2(side, side)
	_board.position = Vector2((size.x - side) / 2.0, y + (board_h - side) / 2.0)

	var row_nodes: Array = []
	row_nodes.append_array(_command_buttons)
	row_nodes.append_array(_stats)
	_sync_tape_scroll()
	_place_row(row_nodes, row_y, control_h, width, m, 10.0)
	_layout_controls(controls_y, control_h, width, m)
	_commands_caption.visible = not compact and not _session.is_finished()


## Places equal-width controls in one row; hidden ones are skipped.
func _place_row(
	nodes: Array, row_y: float, height: float, width: float, m: float, gap: float
) -> void:
	var visible_nodes: Array[Control] = []
	for node: Control in nodes:
		if node.visible:
			visible_nodes.append(node)
	if visible_nodes.is_empty():
		return
	var each := floorf((width - gap * (visible_nodes.size() - 1)) / visible_nodes.size())
	for i in visible_nodes.size():
		visible_nodes[i].position = Vector2(m + i * (each + gap), row_y)
		visible_nodes[i].size = Vector2(each, height)


func _layout_controls(row_y: float, height: float, width: float, m: float) -> void:
	var rows: Array = _control_plan()
	var gap := 10.0
	var total_weight := 0.0
	for item: Array in rows:
		total_weight += float(item[1])
	var x := m
	for item: Array in rows:
		var button: TileButton = item[0]
		var w := floorf((width - gap * (rows.size() - 1)) * float(item[1]) / total_weight)
		button.position = Vector2(x, row_y)
		button.size = Vector2(w, height)
		x += w + gap


## Which control buttons are shown in the bottom row, with relative widths.
func _control_plan() -> Array:
	match _session.state:
		PlaySession.State.SUCCEEDED:
			if app.campaign.next_after(_entry["id"]).is_empty():
				return [[_levels, 0.4], [_replay, 0.6]]
			return [[_levels, 0.27], [_replay, 0.3], [_next, 0.43]]
		PlaySession.State.FAILED:
			return [[_reset, 0.38], [_edit, 0.62]]
		_:
			return [[_step, 0.28], [_run, 0.44], [_reset, 0.28]]


# ----- state to view --------------------------------------------------------------------------


## Brings every control in line with the session state. No animation.
func _refresh() -> void:
	var state := _session.state
	var finished := _session.is_finished()
	var plan := _control_plan()
	for button: TileButton in [_step, _run, _reset, _edit, _levels, _replay, _next]:
		button.visible = false
	for item: Array in plan:
		(item[0] as TileButton).visible = true

	# A loop with no command in it is not a program yet.
	var empty := _tape.is_empty() or _tape.has_empty_loop()
	_step.set_disabled(state == PlaySession.State.RUNNING or empty)
	_reset.set_disabled(state == PlaySession.State.READY)
	match state:
		PlaySession.State.RUNNING:
			_set_run_button("PAUSE", "pause", false)
		PlaySession.State.PAUSED:
			_set_run_button("CONTINUE", "play", false)
		_:
			_set_run_button("RUN", "play", empty)

	var solved := state == PlaySession.State.SUCCEEDED
	var running := state == PlaySession.State.RUNNING
	for button in _command_buttons:
		button.visible = not solved
		button.set_disabled(running or _tape.is_full() or _tape.open_loop_is_full())
	if _repeat_button != null:
		# While a loop is open the Repeat tile ends it (and needs a command inside first).
		if _tape.open_loop() >= 0:
			_repeat_button.label = "END LOOP"
			_repeat_button.icon = "check"
			_repeat_button.set_disabled(running or not _tape.can_end_loop())
		else:
			_repeat_button.label = "REPEAT"
			_repeat_button.icon = "repeat"
			_repeat_button.set_disabled(running or _tape.is_full())
		_repeat_button.queue_redraw()
	for stat in _stats:
		stat.visible = solved
	if solved:
		_update_stats()
	_commands_caption.visible = not solved and size.y >= 760.0
	_update_coach(state)

	_badge.kind = "check" if solved else "x"
	_message.text = _message_text()
	_counter.text = "%d / %d COMMANDS" % [_tape.slots(), _tape.limit]
	_counter.visible = not finished

	_refresh_tools()

	_tape_view.running = state != PlaySession.State.READY
	_tape_view.set_content(
		_tape.cells(), _tape.slots(), _tape.limit, _tape.selected, _tape.open_loop()
	)
	_tape_view.failed_index = _tape.cell_for_node(_session.failing_node())
	_set_head(_session.current_entry())
	_sync_tape_scroll()
	_show_board()
	_layout()
	queue_redraw()
	for node in [_badge, _tape_view]:
		node.queue_redraw()


## Shows the tools that apply to the selected cell: rounds only for a loop's count tile.
func _refresh_tools() -> void:
	var has_selection := _tape.selected >= 0 and not _session.is_active()
	var is_count := _tape.selected_is_count()
	# Order: minus, plus, earlier, later, remove.
	_tools[0].visible = has_selection and is_count
	_tools[1].visible = has_selection and is_count
	for i in range(2, 5):
		_tools[i].visible = has_selection
	if not has_selection:
		return
	var path: Array = _tape.cells()[_tape.selected]["path"]
	var siblings := (
		_tape.nodes.size()
		if path.size() == 1
		else (_tape.nodes[int(path[0])]["body"] as Array).size()
	)
	var place := int(path[path.size() - 1])
	_tools[2].set_disabled(place <= 0)
	_tools[3].set_disabled(place >= siblings - 1)
	var count := int(_tape.cells()[_tape.selected].get("count", 0))
	_tools[0].set_disabled(count <= ContractLimits.REPEAT_COUNT_MIN)
	_tools[1].set_disabled(count >= ContractLimits.REPEAT_COUNT_MAX)


## Points the read-head at the cell the last shown event ran, and shows its loop round.
func _set_head(entry: Dictionary) -> void:
	if entry.is_empty():
		_tape_view.current = 0 if _tape_view.running else -1
		_tape_view.current_round = 0
		return
	_tape_view.current = _tape.cell_for_node(entry["node"])
	_tape_view.current_round = int(entry["round"]) if entry["round"] != null else 0


## A wrapping label first measured at zero width keeps a huge minimum height, so it is sized
## again one frame later, after the label has recomputed its minimum for the real width.
func _settle_message() -> void:
	await get_tree().process_frame
	if is_instance_valid(_message):
		_message.size = _message_box


## Puts the tape where it belongs for the current state: the read-head while a run is shown,
## otherwise the end of the program. Depends on the tape's width, so it also runs after layout.
func _sync_tape_scroll() -> void:
	if _tape_view.running:
		_tape_view.scroll = _tape_view.head_scroll(_tape_view.current)
	elif _tape.selected >= 0:
		# Keep the tile being edited in view; do not jump to the end of the program.
		_tape_view.reveal(_tape.selected)
	else:
		_tape_view.scroll = _tape_view.edit_scroll()
	_tape_view.queue_redraw()


func _set_run_button(label: String, icon: String, disabled: bool) -> void:
	_run.label = label
	_run.icon = icon
	_run.accessibility_name = label
	_run.set_disabled(disabled)
	_run.queue_redraw()


func _message_text() -> String:
	match _session.state:
		PlaySession.State.SUCCEEDED, PlaySession.State.FAILED:
			return ResultMessages.for_result(_session.result).to_upper().trim_suffix(".")
		_:
			if _tape.has_empty_loop():
				return "ADD A COMMAND TO THE LOOP"
			return "REACH THE TARGET"


func _update_stats() -> void:
	var best := app.progress.best_commands(_entry["id"], int(_level["levelVersion"]))
	var used := _tape.slots()
	_stats[0].value = "%d / %d" % [used, _tape.limit]
	_stats[1].value = str(int(_session.result.get("steps", 0)))
	var par: Dictionary = _entry.get("par", {})
	if par.has("commands"):
		_stats[2].caption = "BEST / PAR"
		_stats[2].value = "%s / %d" % [str(best) if best > 0 else "-", int(par["commands"])]
	else:
		_stats[2].caption = "BEST"
		_stats[2].value = str(best) if best > 0 else "-"
	for stat in _stats:
		stat.queue_redraw()


## Shows the board for the session's current cursor, without animation.
func _show_board() -> void:
	var auto := _session.automaton_state()
	_board.show_state(
		auto["position"], auto["direction"], _session.trail(), _session.blocked_cell()
	)


# ----- player actions ---------------------------------------------------------------------------


func _stop_run() -> void:
	_run_id += 1
	_busy = false
	_session.reset()


## Editing from any state other than READY first returns the run to READY.
func _begin_edit() -> void:
	if _session.state == PlaySession.State.RUNNING:
		return
	if _session.state != PlaySession.State.READY:
		_stop_run()


func _on_command(op: String) -> void:
	if _session.state == PlaySession.State.RUNNING:
		return
	_begin_edit()
	if op == TapeModel.REPEAT and _tape.open_loop() >= 0:
		_tape.end_loop()
	else:
		_tape.append(op)
	app.sfx("tap")
	_refresh()


func _on_tile_tapped(index: int) -> void:
	if _session.state == PlaySession.State.RUNNING:
		return
	_begin_edit()
	_tape.toggle_select(index)
	_refresh()


func _on_tool(kind: String) -> void:
	match kind:
		"prev":
			_tape.move_selected(-1)
		"next":
			_tape.move_selected(1)
		"minus":
			_tape.adjust_count(-1)
		"plus":
			_tape.adjust_count(1)
		"x":
			_tape.remove_selected()
	_refresh()


func _on_reset() -> void:
	_stop_run()
	_tape.clear_selection()
	_refresh()


func _on_run() -> void:
	match _session.state:
		PlaySession.State.RUNNING:
			_session.pause()
			_refresh()
		PlaySession.State.PAUSED:
			if not _busy:
				_session.resume()
				_refresh()
				_play_until_stopped()
		PlaySession.State.READY:
			if _start(PlaySession.State.RUNNING):
				_play_until_stopped()


func _on_step() -> void:
	if _session.state == PlaySession.State.RUNNING or _busy or _session.is_finished():
		return
	if _session.state == PlaySession.State.READY and not _start(PlaySession.State.PAUSED):
		return
	_play_one_step()


func _on_next() -> void:
	var next: Dictionary = app.campaign.next_after(_entry["id"])
	if not next.is_empty():
		navigate.emit("play", {"level_id": next["id"]})


func _start(next_state: PlaySession.State) -> bool:
	_tape.clear_selection()
	if (
		_tape.is_empty()
		or _tape.has_empty_loop()
		or not _session.start(_tape.program(), next_state)
	):
		return false
	_run_id += 1
	_refresh()
	return true


# ----- coach, hint, and pause ---------------------------------------------------------------


## The first-run coach on level 1: step 1 until a command is added, step 2 until the run starts.
func _update_coach(state: PlaySession.State) -> void:
	var active := (
		int(_entry["number"]) == 1
		and not app.progress.settings.tutorial_done()
		and state == PlaySession.State.READY
	)
	_coach.visible = active
	if not active:
		return
	if _tape.is_empty():
		_coach.step_number = 1
		_coach.text = "TAP MOVE TO ADD A COMMAND"
	else:
		_coach.step_number = 2
		_coach.text = "TAP RUN TO START YOUR PROGRAM"
	_coach.queue_redraw()


func _open_hint() -> void:
	if _overlay != null:
		return
	var overlay := HintOverlay.new()
	for hint: Variant in _level.get("hints", []):
		overlay.hints.append(str(hint))
	overlay.closed.connect(_close_overlay)
	app.sfx("hint")
	_show_overlay(overlay)


func _open_pause() -> void:
	if _overlay != null:
		return
	if _session.state == PlaySession.State.RUNNING:
		_session.pause()
		_refresh()
	var overlay := PauseOverlay.new()
	overlay.level_caption = "LEVEL %02d" % _entry["number"]
	overlay.resume.connect(_close_overlay)
	overlay.restart.connect(
		func() -> void:
			_close_overlay()
			_on_reset()
	)
	var here := {"back": "play", "back_args": {"level_id": _entry["id"]}}
	overlay.how_to_play.connect(func() -> void: navigate.emit("how_to_play", here))
	overlay.open_settings.connect(func() -> void: navigate.emit("settings", here))
	overlay.back_to_levels.connect(
		func() -> void:
			_close_overlay()
			go_back()
	)
	_show_overlay(overlay)


func _show_overlay(overlay: Control) -> void:
	_overlay = overlay
	add_child(overlay)


func _close_overlay() -> void:
	if _overlay != null:
		_overlay.queue_free()
		_overlay = null


# ----- animation: displays simulation events, never decides them -------------------------------


func _play_until_stopped() -> void:
	var id := _run_id
	while _session.state == PlaySession.State.RUNNING and id == _run_id:
		await _play_one_step()


func _play_one_step() -> void:
	var id := _run_id
	_busy = true
	await _animate_next_step()
	if id == _run_id:
		_busy = false


func _animate_next_step() -> void:
	var id := _run_id
	var entry := _session.advance()
	if entry.is_empty():
		_after_step()
		return
	_tape_view.running = true
	_tape_view.failed_index = -1
	_set_head(entry)
	_board.facing = entry["direction"]
	var cell: Array = entry["position"]
	var target := Vector2(int(cell[0]), int(cell[1]))
	var blocked := str(entry["event"]).begins_with("BLOCKED")
	if blocked:
		app.sfx("blocked")
		app.haptic(40)
	else:
		app.sfx("step")
	var seconds := app.progress.settings.step_seconds()
	var slide := 0.0 if app.progress.settings.reduce_motion() else seconds
	if slide > 0.0:
		var tween := create_tween().set_parallel(true)
		tween.tween_property(_board, "automaton", target, slide)
		tween.tween_property(
			_tape_view, "scroll", _tape_view.head_scroll(_tape_view.current), slide
		)
		await tween.finished
	else:
		_board.automaton = target
		_tape_view.scroll = _tape_view.head_scroll(_tape_view.current)
	if id != _run_id:
		return
	if blocked and slide > 0.0:
		await _nudge(entry["direction"])
		if id != _run_id:
			return
	elif slide == 0.0:
		# Reduce motion: a short beat so each step is still readable.
		await get_tree().create_timer(seconds).timeout
		if id != _run_id:
			return
	_after_step()


func _nudge(direction: String) -> void:
	var delta: Array = ContractLimits.DIRECTION_DELTAS[direction]
	var push := Vector2(float(delta[0]), float(delta[1])) * 0.15
	var tween := create_tween()
	tween.tween_property(_board, "nudge", push, NUDGE_SECONDS)
	tween.tween_property(_board, "nudge", Vector2.ZERO, NUDGE_SECONDS)
	await tween.finished


func _after_step() -> void:
	if _session.state == PlaySession.State.SUCCEEDED:
		app.sfx("success")
		app.haptic(60)
		if persist and int(_entry["number"]) == 1:
			app.progress.settings.set_tutorial_done(true)
		if persist:
			app.progress.record_completion(_entry["id"], int(_level["levelVersion"]), _tape.slots())
			app.progress.save()
			app.request_sync()
	elif _session.state == PlaySession.State.FAILED:
		app.sfx("fail")
	_refresh()


# ----- debug screenshots -----------------------------------------------------------------------


## Debug only (see main.gd): put a program on the tape and show the state after `steps` events
## (-1 for the whole run, 0 for none). Writes no progress.
func debug_show(program_text: String, steps: int) -> void:
	persist = false
	var letters := {"M": "MOVE_FORWARD", "L": "TURN_LEFT", "R": "TURN_RIGHT"}
	# Letters are commands; "3{MRML}" is a loop of three rounds over that body.
	var i := 0
	while i < program_text.length():
		var letter := program_text[i]
		if letter.is_valid_int():
			var end := i
			while end < program_text.length() and program_text[end].is_valid_int():
				end += 1
			var close := program_text.find("}", end)
			var open_end := close < 0
			if open_end:
				close = program_text.length()
			_tape.append(TapeModel.REPEAT)
			_tape.adjust_count(
				int(program_text.substr(i, end - i)) - ContractLimits.REPEAT_COUNT_MIN
			)
			for inner in program_text.substr(end + 1, close - end - 1):
				_tape.append(letters.get(inner, "MOVE_FORWARD"))
			# No closing brace leaves the loop open, as while the player is still building it.
			if not open_end:
				_tape.end_loop()
			i = close + 1
			continue
		_tape.append(letters.get(letter, "MOVE_FORWARD"))
		i += 1
	_tape.clear_selection()
	if steps != 0 and _session.start(_tape.program(), PlaySession.State.PAUSED):
		var count := _session.trace().size() if steps < 0 else steps
		for step in count:
			_session.advance()
		if _session.state == PlaySession.State.SUCCEEDED:
			app.progress.record_completion(_entry["id"], int(_level["levelVersion"]), _tape.slots())
	_refresh()


## Debug only: select a tape cell, to show its tools.
func debug_select(index: int) -> void:
	_tape.toggle_select(index)
	_refresh()


## Debug only: open the "pause" or "hint" panel.
func debug_overlay(kind: String) -> void:
	if kind == "pause":
		_open_pause()
	elif kind == "hint":
		_open_hint()


# ----- small drawn parts -------------------------------------------------------------------------


## The square beside the result message: check for solved, X for failed.
class _Badge:
	extends Control

	var kind := "check"

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		UiKit.fill_chamfer(self, Rect2(Vector2.ZERO, size), Palette.SIGNAL)
		UiKit.icon(self, kind, size / 2.0, size.x * 0.62, Palette.ON_SIGNAL)


## One result figure: a large value over a small caption, in an outlined tile.
class _Stat:
	extends Control

	var value := ""
	var caption := ""

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		var rect := Rect2(Vector2.ZERO, size)
		UiKit.fill_chamfer(self, rect, Palette.GROUND)
		UiKit.outline_chamfer(self, rect, Palette.INK)
		var top := Rect2(0.0, size.y * 0.1, size.x, size.y * 0.55)
		UiKit.text(self, value, top, int(size.y * 0.5), Palette.INK, 0)
		var bottom := Rect2(0.0, size.y * 0.62, size.x, size.y * 0.3)
		UiKit.text(self, caption, bottom, 13, Palette.MUTE, 2)


## The first-run coach: a dark bar with a numbered yellow chip and one instruction.
class _Coach:
	extends Control

	var step_number := 1
	var text := ""

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		visible = false

	func _draw() -> void:
		var rect := Rect2(Vector2.ZERO, size)
		UiKit.fill_chamfer(self, rect, Palette.INK)
		var chip := Rect2(8.0, (size.y - 24.0) / 2.0, 24.0, 24.0)
		UiKit.fill_chamfer(self, chip, Palette.SIGNAL)
		UiKit.text(self, str(step_number), chip, 16, Palette.ON_SIGNAL, 0)
		var area := Rect2(44.0, 0.0, size.x - 56.0, size.y)
		UiKit.text(self, text, area, 15, Palette.ON_INK, 1, HORIZONTAL_ALIGNMENT_LEFT)
