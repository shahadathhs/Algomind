class_name TapeHeaders
extends RefCounted
## The first tile of a loop on the tape. REPEAT shows its count ("x3"); REPEAT_UNTIL shows the
## words UNTIL BLOCKED and a wall icon (or UNTIL GOAL and a ring), because it has no count.
## While a run is shown, the loop the read-head is in shows its 1-based round, and loops already
## passed are solid (TapeView decides which).


## True for the first cell of a loop of either kind.
static func is_header(cell: Dictionary) -> bool:
	return cell["kind"] == "count" or cell["kind"] == "until"


## Draws the header of a loop into rect. `solid` is an ink fill (selected, or already reached by
## the read-head). `round_number` is the round to show: the 1-based round of the loop the
## read-head is in, -1 for a loop that is finished, 0 when it is not known or not running.
static func draw(
	canvas: CanvasItem, cell: Dictionary, rect: Rect2, solid: bool, round_number: int
) -> void:
	if solid:
		UiKit.fill_chamfer(canvas, rect, Palette.INK)
	else:
		UiKit.fill_chamfer(canvas, rect, Palette.FLOOR)
		UiKit.outline_chamfer(canvas, rect, Palette.INK)
	var color := Palette.ON_INK if solid else Palette.INK
	if cell["kind"] == "until":
		_draw_until(canvas, rect, color, maxi(round_number, 0), cell["until"] == "GOAL")
		return
	var count := int(cell["count"])
	# Running: "round/count" once the loop has started, "x3" before it.
	var text := "\u00d7%d" % count
	if round_number != 0:
		text = "%d/%d" % [count if round_number < 0 else round_number, count]
	UiKit.text(canvas, text, rect, int(rect.size.x * 0.42), color, 0)


## "UNTIL" over "BLOCKED" with a wall icon above when the tile is big enough; while the loop
## runs, "ROUND" over the round number replaces the words.
static func _draw_until(
	canvas: CanvasItem, rect: Rect2, color: Color, round_number: int, goal: bool
) -> void:
	var tall := rect.size.y >= 48.0
	var top := rect.position.y + rect.size.y * (0.08 if tall else 0.0)
	var lines: Array[String] = ["UNTIL", "GOAL" if goal else "BLOCKED"]
	if round_number > 0:
		lines = ["ROUND", str(round_number)]
	if tall:
		var center := Vector2(rect.get_center().x, top + rect.size.y * 0.24)
		UiKit.icon(canvas, "goal" if goal else "until", center, rect.size.x * 0.4, color)
	var area := Rect2(
		rect.position.x,
		top + (rect.size.y * 0.4 if tall else 0.0),
		rect.size.x,
		rect.size.y * (0.52 if tall else 1.0)
	)
	var line_h := area.size.y / 2.0
	for k in 2:
		var line_rect := Rect2(area.position.x, area.position.y + k * line_h, area.size.x, line_h)
		var px := fit(lines[k], rect.size.x - 4.0, int(rect.size.x * 0.2))
		UiKit.text(canvas, lines[k], line_rect, px, color, 0)


## The largest font size up to `start` (at least 8) at which `value` fits in `width`.
static func fit(value: String, width: float, start: int) -> int:
	var px := maxi(start, 8)
	while px > 8 and UiKit.text_width(value, px, 0) > width:
		px -= 1
	return px
