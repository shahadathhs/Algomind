extends Control
## Placeholder main screen. Colors come only from the generated Palette.

@onready var _background: ColorRect = $Background
@onready var _title: Label = $Title
@onready var _note: Label = $Note


func _ready() -> void:
	Palette.apply(DisplayServer.is_dark_mode())
	_background.color = Palette.GROUND
	_title.add_theme_color_override("font_color", Palette.INK)
	_note.add_theme_color_override("font_color", Palette.MUTE)
