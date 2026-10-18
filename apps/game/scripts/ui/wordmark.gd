class_name Wordmark
extends Control
## ALGOMIND set as eight chamfered tiles; the first one is yellow.

const WORD := "ALGOMIND"


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	accessibility_name = "Algomind"


func _draw() -> void:
	var gap := roundf(size.x * 0.02)
	var tile_w := (size.x - gap * (WORD.length() - 1)) / WORD.length()
	var tile_h := minf(size.y, tile_w * 1.4)
	var top := (size.y - tile_h) / 2.0
	for i in WORD.length():
		var rect := Rect2(Vector2(i * (tile_w + gap), top), Vector2(tile_w, tile_h))
		var fill := Palette.SIGNAL if i == 0 else Palette.INK
		var on_fill := Palette.ON_SIGNAL if i == 0 else Palette.ON_INK
		UiKit.fill_chamfer(self, rect, fill)
		UiKit.text(self, WORD[i], rect, int(tile_h * 0.68), on_fill, 0)
