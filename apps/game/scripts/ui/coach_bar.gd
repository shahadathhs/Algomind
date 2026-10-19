class_name CoachBar
extends Control
## The first-run coach: a dark bar with a numbered yellow chip and one instruction.

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
