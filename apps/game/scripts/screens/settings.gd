extends ScreenBase
## Settings: theme (system, light, dark) and reduce motion. Sound is not offered because the
## game has no audio yet; a switch that does nothing would be misleading.

const THEME_NAMES: Array[String] = ["system", "light", "dark"]

var _back: TileButton
var _title: Label
var _theme_caption: Label
var _theme_buttons: Array[TileButton] = []
var _motion_caption: Label
var _motion_hint: Label
var _motion_toggle: TileButton


func _build() -> void:
	_back = TileButton.make(TileButton.Kind.SECONDARY, "", "back")
	_back.accessibility_name = "Back"
	_back.pressed.connect(go_back)
	add_child(_back)

	_title = UiKit.label("SETTINGS", 34, Palette.INK, 1)
	add_child(_title)

	_theme_caption = UiKit.label("THEME", 14, Palette.MUTE, 2)
	add_child(_theme_caption)
	for theme_name in THEME_NAMES:
		var selected := app.progress.theme() == theme_name
		var kind := TileButton.Kind.SOLID if selected else TileButton.Kind.SECONDARY
		var button := TileButton.make(kind, theme_name.to_upper(), "check" if selected else "", 20)
		button.accessibility_name = "Theme %s%s" % [theme_name, ", selected" if selected else ""]
		button.pressed.connect(_set_theme.bind(theme_name))
		add_child(button)
		_theme_buttons.append(button)

	_motion_caption = UiKit.label("REDUCE MOTION", 14, Palette.MUTE, 2)
	add_child(_motion_caption)
	_motion_hint = UiKit.label(
		"The tape and the automaton jump instead of sliding.", 16, Palette.INK, 0
	)
	_motion_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_motion_hint)
	var on := app.progress.reduce_motion()
	var motion_kind := TileButton.Kind.PRIMARY if on else TileButton.Kind.SECONDARY
	_motion_toggle = TileButton.make(motion_kind, "ON" if on else "OFF", "check" if on else "", 22)
	_motion_toggle.accessibility_name = "Reduce motion, %s" % ("on" if on else "off")
	_motion_toggle.pressed.connect(_toggle_motion)
	add_child(_motion_toggle)


func go_back() -> void:
	navigate.emit("home", {})


func _layout() -> void:
	if _motion_toggle == null:
		return
	var m := margin()
	var width := size.x - 2.0 * m
	var top := inset_top() + (28.0 if size.y >= 700.0 else 12.0)
	_back.position = Vector2(m, top)
	_back.size = Vector2(44.0, 44.0)
	_title.position = Vector2(m, top + 54.0)
	_title.size = Vector2(width, 40.0)
	var y := _title.position.y + 64.0
	_theme_caption.position = Vector2(m, y)
	_theme_caption.size = Vector2(width, 20.0)
	y += 28.0
	var gap := 10.0
	var button_w := floorf((width - gap * 2.0) / 3.0)
	for i in _theme_buttons.size():
		_theme_buttons[i].position = Vector2(m + i * (button_w + gap), y)
		_theme_buttons[i].size = Vector2(button_w, 52.0)
	y += 52.0 + 32.0
	_motion_caption.position = Vector2(m, y)
	_motion_caption.size = Vector2(width, 20.0)
	y += 28.0
	var toggle_w := 96.0
	_motion_hint.position = Vector2(m, y)
	_motion_hint.size = Vector2(width - toggle_w - 16.0, 44.0)
	_motion_toggle.position = Vector2(size.x - m - toggle_w, y - 4.0)
	_motion_toggle.size = Vector2(toggle_w, 52.0)


func _set_theme(theme_name: String) -> void:
	app.progress.set_theme(theme_name)
	app.progress.save()
	navigate.emit("settings", {})


func _toggle_motion() -> void:
	app.progress.set_reduce_motion(not app.progress.reduce_motion())
	app.progress.save()
	navigate.emit("settings", {})
