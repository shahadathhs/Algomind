class_name PlayBuilder
extends RefCounted
## Creates the child nodes of the play screen and hands them back through its fields.


static func build(p: PlayScreen, available: Array[String]) -> void:
	_build_header(p)
	_build_objective(p)
	p._board = BoardView.new()
	p._board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(p._board)
	p._board.set_level(p._level)
	_build_tape(p)
	_build_commands(p, available)
	for caption in ["COMMANDS", "STEPS", "BEST"]:
		var stat := StatTile.new()
		stat.caption = caption
		p.add_child(stat)
		p._stats.append(stat)
	_build_controls(p)


static func make_button(
	p: PlayScreen, kind: TileButton.Kind, label: String, icon: String, handler: Callable
) -> TileButton:
	var button := TileButton.make(kind, label, icon, 20 if kind != TileButton.Kind.PRIMARY else 24)
	button.pressed.connect(handler)
	p.add_child(button)
	return button


static func _build_header(p: PlayScreen) -> void:
	p._back = TileButton.make(TileButton.Kind.SECONDARY, "", "back")
	p._back.accessibility_name = "Back to levels"
	p._back.pressed.connect(p.go_back)
	p.add_child(p._back)
	var caption := "LEVEL %02d" % p._entry["number"]
	var title := str(p._level["title"]).to_upper()
	var title_px := 24
	if p._entry.has("daily"):
		caption = title
		title = "DAILY %s" % p._entry["daily"]
		title_px = 20
	p._caption = UiKit.label(caption, 14, Palette.MUTE, 3)
	p._caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	p.add_child(p._caption)
	p._title = UiKit.label(title, title_px, Palette.INK, 1)
	p._title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	p._title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	p.add_child(p._title)
	p._help = TileButton.make(TileButton.Kind.SECONDARY, "", "help")
	p._help.accessibility_name = "Hint"
	p._help.pressed.connect(p._open_hint)
	p.add_child(p._help)
	p._menu = TileButton.make(TileButton.Kind.SECONDARY, "", "menu")
	p._menu.accessibility_name = "Pause menu"
	p._menu.pressed.connect(p._open_pause)
	p.add_child(p._menu)
	p._coach = CoachBar.new()
	p.add_child(p._coach)


static func _build_objective(p: PlayScreen) -> void:
	p._badge = ResultBadge.new()
	p.add_child(p._badge)
	p._message = UiKit.label("", 18, Palette.INK, 1)
	p._message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	p._message.add_theme_constant_override("line_spacing", -4)
	p._message.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	p.add_child(p._message)
	p._counter = UiKit.label("", 18, Palette.MUTE, 1)
	p._counter.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	p._counter.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	p.add_child(p._counter)


static func _build_tape(p: PlayScreen) -> void:
	p._program_caption = UiKit.label("PROGRAM", 14, Palette.MUTE, 3)
	p._program_caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	p.add_child(p._program_caption)
	for tool in [
		["minus", "Fewer rounds"],
		["plus", "More rounds"],
		["prev", "Move earlier"],
		["next", "Move later"],
		["x", "Remove"],
	]:
		var button := TileButton.make(TileButton.Kind.SECONDARY, "", tool[0])
		button.accessibility_name = tool[1]
		button.pressed.connect(p._on_tool.bind(tool[0]))
		p.add_child(button)
		p._tools.append(button)
	p._tape_view = TapeView.new()
	p._tape_view.accessibility_name = "Program"
	p._tape_view.tile_tapped.connect(p._on_tile_tapped)
	p.add_child(p._tape_view)


static func _build_commands(p: PlayScreen, available: Array[String]) -> void:
	p._commands_caption = UiKit.label("COMMANDS", 14, Palette.MUTE, 3)
	p.add_child(p._commands_caption)
	var offered := 0
	for command in PlayScreen.COMMANDS:
		if available.has(command["op"]):
			offered += 1
	for command in PlayScreen.COMMANDS:
		if not available.has(command["op"]):
			continue
		# Four tiles share a row, so their labels are a little smaller; five stack icon over label.
		var button := TileButton.make(
			TileButton.Kind.SECONDARY, command["label"], command["icon"], 20 if offered < 4 else 14
		)
		button.stacked = offered >= 5
		button.accessibility_name = command.get("name", command["label"])
		button.pressed.connect(p._on_command.bind(command["op"]))
		p.add_child(button)
		p._command_buttons.append(button)
		if ContractLimits.is_loop(command["op"]):
			p._loop_buttons[command["op"]] = button


static func _build_controls(p: PlayScreen) -> void:
	var secondary := TileButton.Kind.SECONDARY
	var primary := TileButton.Kind.PRIMARY
	p._step = make_button(p, secondary, "STEP", "step", p._on_step)
	p._run = make_button(p, primary, "RUN", "play", p._on_run)
	p._reset = make_button(p, secondary, "RESET", "reset", p._on_reset)
	p._edit = make_button(p, primary, "EDIT PROGRAM", "", p._on_reset)
	p._levels = make_button(
		p, secondary, "DAILY" if p._entry.has("daily") else "LEVELS", "", p.go_back
	)
	p._replay = make_button(p, secondary, "REPLAY", "reset", p._on_reset)
	p._next = make_button(p, primary, "NEXT", "", p._on_next)
	p._share = make_button(p, secondary, "SHARE", "", func() -> void: PlayShare.share(p))
	p._ranking = make_button(p, secondary, "RANKING", "", func() -> void: PlayShare.ranking(p))
