extends ScreenBase
## Settings: sound, music, vibration, reduce motion, run speed, and theme. Every choice shows its
## state in words as well as fill, and each change is saved at once.
##
## Opened from the menu or from the pause menu; `args["back"]` names where Back returns to.

const ROW_HEIGHT := 52.0
const THEME_NAMES: Array[String] = ["system", "light", "dark"]
const SPEED_NAMES: Array[String] = ["slow", "normal", "fast"]

var _back: TileButton
var _title: Label
var _scroll: ScrollContainer
var _list: VBoxContainer
var _privacy: TileButton
var _version: Label


func _build() -> void:
	_back = TileButton.make(TileButton.Kind.SECONDARY, "", "back")
	_back.accessibility_name = "Back"
	_back.pressed.connect(go_back)
	add_child(_back)

	_title = UiKit.label("SETTINGS", 34, Palette.INK, 1)
	add_child(_title)

	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	add_child(_scroll)
	_list = VBoxContainer.new()
	_list.add_theme_constant_override("separation", 10)
	_scroll.add_child(_list)

	var settings := app.progress.settings
	_list.add_child(_caption("AUDIO AND TOUCH"))
	_list.add_child(_toggle_row("SOUND", settings.sound(), _toggle_sound))
	_list.add_child(_toggle_row("MUSIC", settings.music(), _toggle_music))
	# The browser build has no vibration and no link out: the site around it has both.
	if not OS.has_feature("web"):
		_list.add_child(_toggle_row("VIBRATION", settings.vibration(), _toggle_vibration))
	_list.add_child(_gap(10.0))
	_list.add_child(_caption("MOTION"))
	_list.add_child(_toggle_row("REDUCE MOTION", settings.reduce_motion(), _toggle_motion))
	_list.add_child(_segment_row("RUN SPEED", SPEED_NAMES, settings.run_speed(), _set_speed))
	_list.add_child(_gap(10.0))
	_list.add_child(_caption("LOOK"))
	_list.add_child(_segment_row("THEME", THEME_NAMES, settings.theme(), _set_theme))

	if not OS.has_feature("web"):
		_privacy = TileButton.make(TileButton.Kind.TERTIARY, "PRIVACY", "", 16)
		_privacy.align = HORIZONTAL_ALIGNMENT_LEFT
		_privacy.pressed.connect(func() -> void: Links.open("/privacy"))
		add_child(_privacy)
	_version = UiKit.label("VERSION %s" % Links.version(), 14, Palette.MUTE, 2)
	_version.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_version)


func go_back() -> void:
	navigate.emit(str(args.get("back", "home")), args.get("back_args", {}))


func _layout() -> void:
	if _version == null:
		return
	var m := margin()
	var width := size.x - 2.0 * m
	var top := inset_top() + (28.0 if size.y >= 700.0 else 12.0)
	_back.position = Vector2(m, top)
	_back.size = Vector2(44.0, 44.0)
	_title.position = Vector2(m, top + 54.0)
	_title.size = Vector2(width, 40.0)
	var footer_h := 48.0
	var bottom := size.y - inset_bottom() - m
	if _privacy != null:
		_privacy.position = Vector2(m, bottom - footer_h)
		_privacy.size = Vector2(width * 0.4, footer_h)
	_version.position = Vector2(size.x - m - width * 0.55, bottom - footer_h)
	_version.size = Vector2(width * 0.55, footer_h)
	var list_top := _title.position.y + 56.0
	_scroll.position = Vector2(m, list_top)
	_scroll.size = Vector2(width, bottom - footer_h - 8.0 - list_top)
	_list.custom_minimum_size = Vector2(width, 0)


func _caption(value: String) -> Label:
	return UiKit.label(value, 14, Palette.MUTE, 2)


func _gap(height: float) -> Control:
	var node := Control.new()
	node.custom_minimum_size = Vector2(0, height)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node


## A row with a label on the left and an ON/OFF tile on the right. ON is yellow with a check.
func _toggle_row(caption: String, on: bool, handler: Callable) -> Control:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(0, ROW_HEIGHT)
	var label := UiKit.label(caption, 20, Palette.INK, 1)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(label)
	var kind := TileButton.Kind.PRIMARY if on else TileButton.Kind.SECONDARY
	var button := TileButton.make(kind, "ON" if on else "OFF", "check" if on else "", 18)
	button.accessibility_name = "%s, %s" % [caption.capitalize(), "on" if on else "off"]
	button.custom_minimum_size = Vector2(92.0, ROW_HEIGHT)
	button.pressed.connect(handler)
	row.add_child(button)
	return row


## A row with a label and a segmented choice: the selected segment is solid and checked.
func _segment_row(
	caption: String, names: Array[String], current: String, handler: Callable
) -> Control:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	box.add_child(UiKit.label(caption, 20, Palette.INK, 1))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	for option in names:
		var selected := option == current
		var kind := TileButton.Kind.SOLID if selected else TileButton.Kind.SECONDARY
		var button := TileButton.make(kind, option.to_upper(), "check" if selected else "", 16)
		button.accessibility_name = (
			"%s %s%s" % [caption.capitalize(), option, ", selected" if selected else ""]
		)
		button.custom_minimum_size = Vector2(0, ROW_HEIGHT)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(handler.bind(option))
		row.add_child(button)
	box.add_child(row)
	return box


func _changed() -> void:
	app.progress.save()
	app.request_sync()
	if app.feedback != null:
		app.feedback.apply_music()
	app.apply_theme()
	navigate.emit("settings", args)


func _toggle_sound() -> void:
	app.progress.settings.set_sound(not app.progress.settings.sound())
	_changed()
	app.sfx("tap")


func _toggle_music() -> void:
	app.progress.settings.set_music(not app.progress.settings.music())
	_changed()


func _toggle_vibration() -> void:
	app.progress.settings.set_vibration(not app.progress.settings.vibration())
	_changed()
	app.haptic(40)


func _toggle_motion() -> void:
	app.progress.settings.set_reduce_motion(not app.progress.settings.reduce_motion())
	_changed()


func _set_speed(option: String) -> void:
	app.progress.settings.set_run_speed(option)
	_changed()


func _set_theme(option: String) -> void:
	app.progress.settings.set_theme(option)
	_changed()
