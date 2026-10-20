class_name TapeHeaders
extends RefCounted
## The first tile of a loop on the tape. REPEAT shows its count ("x3"); REPEAT_UNTIL shows the
## words UNTIL BLOCKED and a wall icon, because it has no count. While a run is shown, the
## loop the read-head is in shows its 1-based round, and loops already passed are solid.


## True for the first cell of a loop of either kind.
static func is_header(cell: Dictionary) -> bool:
	return cell["kind"] == "count" or cell["kind"] == "until"


## Draws the header at cells[index] into rect. `state` has running (bool), current (cell index
## under the read-head, -1 before the first step) and round (1-based, 0 when none).
static func draw(
	canvas: CanvasItem,
	cells: Array[Dictionary],
	index: int,
	rect: Rect2,
	is_selected: bool,
	state: Dictionary
) -> void:
	var cell := cells[index]
	var running: bool = state["running"]
	var current: int = state["current"]
	var loop := int((cell["path"] as Array)[0])
	var solid := not running and is_selected
	var in_loop := false
	if running and current >= 0:
		var here := int((cells[current]["path"] as Array)[0])
		if loop < here:
			solid = true
		elif loop == here:
			solid = true
			in_loop = true
	if solid:
		UiKit.fill_chamfer(canvas, rect, Palette.INK)
	else:
		UiKit.fill_chamfer(canvas, rect, Palette.FLOOR)
		UiKit.outline_chamfer(canvas, rect, Palette.INK)
	var color := Palette.ON_INK if solid else Palette.INK
	var round_number := maxi(int(state["round"]), 1)
	if cell["kind"] == "until":
		_draw_until(canvas, rect, color, round_number if in_loop else 0)
		return
	var count := int(cell["count"])
	# Running: "round/count" once the loop has started, "x3" before it.
	var text := "\u00d7%d" % count
	if running and current >= 0 and solid:
		text = "%d/%d" % [round_number if in_loop else count, count]
	UiKit.text(canvas, text, rect, int(rect.size.x * 0.42), color, 0)


## "UNTIL" over "BLOCKED" with a wall icon above when the tile is big enough; while the loop
## runs, "ROUND" over the round number replaces the words.
static func _draw_until(canvas: CanvasItem, rect: Rect2, color: Color, round_number: int) -> void:
	var tall := rect.size.y >= 48.0
	var top := rect.position.y + rect.size.y * (0.08 if tall else 0.0)
	var lines: Array[String] = ["UNTIL", "BLOCKED"]
	if round_number > 0:
		lines = ["ROUND", str(round_number)]
	if tall:
		var center := Vector2(rect.get_center().x, top + rect.size.y * 0.24)
		UiKit.icon(canvas, "until", center, rect.size.x * 0.4, color)
	var area := Rect2(
		rect.position.x,
		top + (rect.size.y * 0.4 if tall else 0.0),
		rect.size.x,
		rect.size.y * (0.52 if tall else 1.0)
	)
	var line_h := area.size.y / 2.0
	for k in 2:
		var line_rect := Rect2(area.position.x, area.position.y + k * line_h, area.size.x, line_h)
		var px := _fit(lines[k], rect.size.x - 4.0, int(rect.size.x * 0.2))
		UiKit.text(canvas, lines[k], line_rect, px, color, 0)


## The largest font size up to `start` (at least 8) at which `value` fits in `width`.
static func _fit(value: String, width: float, start: int) -> int:
	var px := maxi(start, 8)
	while px > 8 and UiKit.text_width(value, px, 0) > width:
		px -= 1
	return px
