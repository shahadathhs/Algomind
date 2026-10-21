class_name TapeIfCells
extends RefCounted
## The two tiles of an IF that are not commands: its header, which reads "IF" and what the
## sensor looks at (an arrow and the word AHEAD, LEFT or RIGHT, so color is never the only
## signal), and the ELSE divider between the then and else tiles.

const SENSOR_WORDS := {"CLEAR_AHEAD": "AHEAD", "CLEAR_LEFT": "LEFT", "CLEAR_RIGHT": "RIGHT"}
const SENSOR_ICONS := {
	"CLEAR_AHEAD": "ahead", "CLEAR_LEFT": "sense_left", "CLEAR_RIGHT": "sense_right"
}


## True for the header tile of an IF.
static func is_header(cell: Dictionary) -> bool:
	return cell["kind"] == "if"


## The word shown for a sensor ("AHEAD").
static func word(sensor: Variant) -> String:
	return SENSOR_WORDS.get(sensor, "AHEAD")


## The icon kind shown for a sensor ("ahead").
static func icon(sensor: Variant) -> String:
	return SENSOR_ICONS.get(sensor, "ahead")


## Draws the IF header. `solid` is an ink fill (selected, or already passed by the read-head).
static func draw_header(canvas: CanvasItem, cell: Dictionary, rect: Rect2, solid: bool) -> void:
	if solid:
		UiKit.fill_chamfer(canvas, rect, Palette.INK)
	else:
		UiKit.fill_chamfer(canvas, rect, Palette.FLOOR)
		UiKit.outline_chamfer(canvas, rect, Palette.INK)
	var color := Palette.ON_INK if solid else Palette.INK
	var tall := rect.size.y >= 48.0
	var top := rect.position.y + rect.size.y * (0.06 if tall else 0.0)
	var band := rect.size.y * (0.3 if tall else 0.5)
	UiKit.text(
		canvas,
		"IF",
		Rect2(rect.position.x, top, rect.size.x, band),
		int(rect.size.x * (0.3 if tall else 0.34)),
		color,
		1
	)
	if tall:
		var center := Vector2(rect.get_center().x, top + band + rect.size.y * 0.18)
		UiKit.icon(canvas, icon(cell["when"]), center, rect.size.x * 0.36, color)
	var label := word(cell["when"])
	var area := Rect2(
		rect.position.x,
		top + band + (rect.size.y * 0.32 if tall else 0.0),
		rect.size.x,
		rect.size.y * (0.3 if tall else 0.5)
	)
	UiKit.text(canvas, label, area, TapeHeaders.fit(label, rect.size.x - 4.0, 12), color, 0)


## Draws the ELSE divider: a dashed tile with the word, no fill.
static func draw_else(canvas: CanvasItem, rect: Rect2) -> void:
	UiKit.outline_chamfer(canvas, rect, Palette.INK, 2.0, true)
	UiKit.text(canvas, "ELSE", rect, TapeHeaders.fit("ELSE", rect.size.x - 4.0, 14), Palette.INK, 1)
