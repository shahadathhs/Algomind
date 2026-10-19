class_name ResultBadge
extends Control
## The square beside the result message: check for solved, X for failed.

var kind := "check"


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	UiKit.fill_chamfer(self, Rect2(Vector2.ZERO, size), Palette.SIGNAL)
	UiKit.icon(self, kind, size / 2.0, size.x * 0.62, Palette.ON_SIGNAL)
