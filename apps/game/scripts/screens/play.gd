extends ScreenBase
## Play: board, tape, commands, and controls for one level.
##
## The simulation runs first and in one call (PlaySession.start). This screen then replays the
## resulting events with short animations. Animation length never changes the outcome, and with
## Reduce motion the tape and automaton jump instead of sliding.

const STEP_SECONDS := 0.2
const NUDGE_SECONDS := 0.08
const COMMANDS: Array[Dictionary] = [
	{"op": "MOVE_FORWARD", "label": "MOVE", "icon": "move"},
	{"op": "TURN_LEFT", "label": "LEFT", "icon": "left"},
	{"op": "TURN_RIGHT", "label": "RIGHT", "icon": "right"},
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

var _back: TileButton
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
		navigate.emit.call_deferred("levels", {})
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
	add_child(_title)

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
	for tool in [["prev", "Move earlier"], ["next", "Move later"], ["x", "Remove"]]:
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
	for command in COMMANDS:
		if not available.has(command["op"]):
			continue
		var button := TileButton.make(
			TileButton.Kind.SECONDARY, command["label"], command["icon"], 20
		)
		button.pressed.connect(_on_command.bind(command["op"]))
		add_child(button)
		_command_buttons.append(button)

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
	_run_id += 1
	navigate.emit("levels", {})


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
	_caption.position = Vector2(m + 54.0, y)
	_caption.size = Vector2(width - 108.0, 18.0)
	_title.position = Vector2(m + 54.0, y + 16.0)
	_title.size = Vector2(width - 108.0, 30.0)
	y += 44.0 + (10.0 if compact else 12.0)

	var objective_h := 52.0 if compact else 54.0
	var finished := _session.is_finished()
	var counter_w := 0.0 if finished else 150.0
	var badge_w := 40.0 if finished else 0.0
	_badge.visible = finished
	_badge.position = Vector2(m, y + (objective_h - 28.0) / 2.0)
	_badge.size = Vector2(28.0, 28.0)
	_message.position = Vector2(m + badge_w, y)
	_message.size = Vector2(
		width - badge_w - counter_w - (8.0 if counter_w > 0.0 else 0.0), objective_h
	)
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
	var tape_h := 84.0 if compact else 112.0
	_tape_view.position = Vector2(m, cursor - tape_h)
	_tape_view.size = Vector2(width, tape_h)
	cursor = _tape_view.position.y - 6.0
	var caption_h := 40.0 if compact else 44.0
	_program_caption.position = Vector2(m, cursor - caption_h)
	_program_caption.size = Vector2(width * 0.4, caption_h)
	for i in _tools.size():
		var tool_size := caption_h - 4.0
		_tools[i].size = Vector2(tool_size, tool_size)
		_tools[i].position = Vector2(
			size.x - m - (3 - i) * (tool_size + 8.0) + 8.0, cursor - caption_h + 2.0
		)
	cursor = _program_caption.position.y - 4.0

	var board_h := cursor - y
	var side := minf(width, board_h)
	_board.size = Vector2(side, side)
	_board.position = Vector2((size.x - side) / 2.0, y + (board_h - side) / 2.0)

	var row_nodes: Array = []
	row_nodes.append_array(_command_buttons)
	row_nodes.append_array(_stats)
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

	var empty := _tape.size() == 0
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
	for button in _command_buttons:
		button.visible = not solved
		button.set_disabled(state == PlaySession.State.RUNNING or _tape.is_full())
	for stat in _stats:
		stat.visible = solved
	if solved:
		_update_stats()
	_commands_caption.visible = not solved and size.y >= 760.0

	_badge.kind = "check" if solved else "x"
	_message.text = _message_text()
	_counter.text = "%d / %d COMMANDS" % [_tape.size(), _tape.limit]
	_counter.visible = not finished

	for i in _tools.size():
		_tools[i].visible = _tape.selected >= 0 and not _session.is_active()
	_tools[0].set_disabled(_tape.selected <= 0)
	_tools[1].set_disabled(_tape.selected < 0 or _tape.selected >= _tape.size() - 1)

	_tape_view.set_content(_tape.ops, _tape.limit, _tape.selected)
	_tape_view.running = state != PlaySession.State.READY
	_tape_view.failed_index = _session.failing_index()
	_tape_view.current = (
		_session.cursor - 1 if _session.cursor > 0 else (0 if _tape_view.running else -1)
	)
	if _tape_view.running:
		_tape_view.scroll = _tape_view.head_scroll(_tape_view.current)
	else:
		_tape_view.scroll = _tape_view.edit_scroll()
	_show_board()
	_layout()
	queue_redraw()
	for node in [_badge, _tape_view]:
		node.queue_redraw()


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
			return "REACH THE TARGET"


func _update_stats() -> void:
	var best := app.progress.best_commands(_entry["id"], int(_level["levelVersion"]))
	var used := _tape.size()
	_stats[0].value = "%d / %d" % [used, _tape.limit]
	_stats[1].value = str(int(_session.result.get("steps", 0)))
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
	_tape.append(op)
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
	if _tape.size() == 0 or not _session.start(_tape.program(), next_state):
		return false
	_run_id += 1
	_refresh()
	return true


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
	_tape_view.current = int(entry["index"])
	_board.facing = entry["direction"]
	var cell: Array = entry["position"]
	var target := Vector2(int(cell[0]), int(cell[1]))
	var blocked := str(entry["event"]).begins_with("BLOCKED")
	var slide := 0.0 if app.progress.reduce_motion() else STEP_SECONDS
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
		await get_tree().create_timer(STEP_SECONDS).timeout
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
	if _session.state == PlaySession.State.SUCCEEDED and persist:
		app.progress.record_completion(_entry["id"], int(_level["levelVersion"]), _tape.size())
		app.progress.save()
	_refresh()


# ----- debug screenshots -----------------------------------------------------------------------


## Debug only (see main.gd): put a program on the tape and show the state after `steps` events
## (-1 for the whole run, 0 for none). Writes no progress.
func debug_show(program_text: String, steps: int) -> void:
	persist = false
	var letters := {"M": "MOVE_FORWARD", "L": "TURN_LEFT", "R": "TURN_RIGHT"}
	for letter in program_text:
		_tape.append(letters.get(letter, "MOVE_FORWARD"))
	if steps != 0 and _session.start(_tape.program(), PlaySession.State.PAUSED):
		var count := _session.trace().size() if steps < 0 else steps
		for i in count:
			_session.advance()
		if _session.state == PlaySession.State.SUCCEEDED:
			app.progress.record_completion(_entry["id"], int(_level["levelVersion"]), _tape.size())
	_refresh()


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
