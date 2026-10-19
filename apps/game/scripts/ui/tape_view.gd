class_name TapeView
extends Control
## The tape: a strip of instruction tiles, with a loop drawn as a count tile and its body inside
## one bracket.
##
## Editing: left-aligned, a dashed plus slot at the end, drag to scroll when it overflows.
## Running: a fixed read-head at the center; `scroll` is animated by the play screen so the
## current tile sits under it. States per tile: executed (solid), current (yellow), upcoming
## (outlined), failed (yellow with an X). The view only displays; it never runs anything.

signal tile_tapped(index: int)

const PAD := 12.0
const DRAG_SLOP := 10.0
## Room between a loop's bracket and its tiles, and between a bracket and its neighbours.
const GROUP_PAD := 5.0

## The cells to show (TapeModel.cells()): one per slot.
var cells: Array[Dictionary] = []
var limit := 0
var used := 0
var selected := -1
## Program index of the loop that is open (takes the next command), or -1.
var open_loop := -1
## False while editing; true when the read-head is shown.
var running := false
## Index of the cell under the read-head, or -1 before the first step.
var current := -1
## The 1-based round of the loop the read-head is in, or 0.
var current_round := 0
var failed_index := -1
## Horizontal offset of the strip in pixels.
var scroll := 0.0:
	set(value):
		scroll = value
		queue_redraw()

var _rects: Array[Rect2] = []
var _groups: Array[Rect2] = []
var _group_loops: Array[int] = []
var _slot := Rect2()
var _content_end := 0.0
var _press_at := Vector2.ZERO
var _press_scroll := 0.0
var _pressing := false
var _dragged := false


## Tile side for a control of this height (room for the number row and the read-head).
static func tile_for_height(height: float) -> float:
	return floorf(clampf(height - 54.0, 40.0, 60.0))


func tile_size() -> float:
	return tile_for_height(size.y)


func pitch() -> float:
	return tile_size() * 1.24


func set_content(
	tape_cells: Array[Dictionary],
	used_slots: int,
	max_commands: int,
	selected_index: int,
	open: int
) -> void:
	cells = tape_cells
	used = used_slots
	limit = max_commands
	selected = selected_index
	open_loop = open
	_layout_cells()
	queue_redraw()


func _top() -> float:
	return 22.0 if running else 12.0


## Places every cell, loop bracket, and the dashed slot in strip coordinates (before scroll).
func _layout_cells() -> void:
	_rects.clear()
	_groups.clear()
	_group_loops.clear()
	_slot = Rect2()
	var tile := tile_size()
	var gap := pitch() - tile
	var top := _top()
	var x := PAD
	var group_start := -1.0
	var group_loop := -1
	for i in cells.size():
		var cell := cells[i]
		var path: Array = cell["path"]
		var in_group: bool = cell["kind"] == "count" or path.size() == 2
		if cell["kind"] == "count":
			x += GROUP_PAD
			group_start = x
			group_loop = int(path[0])
			x += GROUP_PAD
		_rects.append(Rect2(Vector2(x, top), Vector2(tile, tile)))
		x += pitch()
		var ends_group := in_group
		if i + 1 < cells.size():
			var next_path: Array = cells[i + 1]["path"]
			ends_group = in_group and (cells[i + 1]["kind"] == "count" or next_path.size() == 1)
		if in_group and ends_group:
			var end_x := x - gap + GROUP_PAD
			if group_loop == open_loop and used < limit:
				_slot = Rect2(Vector2(x, top), Vector2(tile, tile))
				end_x = x + tile + GROUP_PAD
				x += pitch()
			_groups.append(
				Rect2(group_start, top - GROUP_PAD, end_x - group_start, tile + 2.0 * GROUP_PAD)
			)
			_group_loops.append(group_loop)
			x = end_x + gap
	if _slot.size == Vector2.ZERO and not running and used < limit:
		_slot = Rect2(Vector2(x, top), Vector2(tile, tile))
		x += pitch()
	_content_end = x + PAD


## The scroll that shows the end of the program (the slot where the next tile goes).
func edit_scroll() -> float:
	return maxf(0.0, _content_end - size.x)


## Scrolls just enough to show cell `index` in full, and not at all when it is already visible.
func reveal(index: int) -> void:
	if index < 0 or index >= _rects.size():
		return
	var rect := _rects[index]
	var next := scroll
	if rect.position.x - PAD < next:
		next = rect.position.x - PAD
	elif rect.end.x + PAD > next + size.x:
		next = rect.end.x + PAD - size.x
	scroll = clampf(next, 0.0, edit_scroll())


## The scroll that puts cell `index` under the read-head at the center.
func head_scroll(index: int) -> float:
	if index < 0 or index >= _rects.size():
		return 0.0
	return _rects[index].get_center().x - size.x / 2.0


func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	var motion := event as InputEventMouseMotion
	if click != null and click.button_index == MOUSE_BUTTON_LEFT:
		if click.pressed:
			_pressing = true
			_dragged = false
			_press_at = click.position
			_press_scroll = scroll
		else:
			if _pressing and not _dragged:
				tile_tapped.emit(_index_at(click.position))
			_pressing = false
	elif motion != null and _pressing:
		if absf(motion.position.x - _press_at.x) > DRAG_SLOP:
			_dragged = true
		if _dragged and not running:
			scroll = clampf(_press_scroll - (motion.position.x - _press_at.x), 0.0, edit_scroll())


func _index_at(point: Vector2) -> int:
	var x := point.x + scroll
	for i in _rects.size():
		if x >= _rects[i].position.x and x <= _rects[i].end.x:
			return i
	return -1


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Palette.STRIP)
	for g in _groups.size():
		var group := _groups[g]
		group.position.x -= scroll
		if group.end.x < 0.0 or group.position.x > size.x:
			continue
		UiKit.outline_chamfer(
			self, group, Palette.INK, 2.0, _group_loops[g] == open_loop and not running
		)
	for i in cells.size():
		var rect := _rects[i]
		rect.position.x -= scroll
		if rect.end.x < 0.0 or rect.position.x > size.x:
			continue
		_draw_tile(i, rect)
		var number := "%02d" % (i + 1)
		var number_rect := Rect2(rect.position.x, rect.end.y + 2.0, rect.size.x, 22.0)
		var number_color := Palette.INK if i == current and running else Palette.MUTE
		UiKit.text(self, number, number_rect, 14, number_color, 1)
	if _slot.size != Vector2.ZERO and not running:
		var slot := _slot
		slot.position.x -= scroll
		UiKit.outline_chamfer(self, slot, Palette.SLOT, 2.0, true)
		UiKit.icon(self, "plus", slot.get_center(), slot.size.x * 0.5, Palette.SLOT)
	if running:
		_draw_head()


func _draw_tile(index: int, rect: Rect2) -> void:
	var cell := cells[index]
	if cell["kind"] == "count":
		_draw_count(index, rect)
		return
	var kind := _icon_for(cell["op"])
	var center := rect.get_center()
	var icon_size := rect.size.x * 0.5
	if index == failed_index and running:
		UiKit.fill_chamfer(self, rect, Palette.SIGNAL)
		UiKit.icon(self, "x", center, icon_size, Palette.ON_SIGNAL)
	elif running and index == current:
		UiKit.fill_chamfer(self, rect, Palette.SIGNAL)
		UiKit.icon(self, kind, center, icon_size, Palette.ON_SIGNAL)
	elif running and index < current:
		UiKit.fill_chamfer(self, rect, Palette.INK)
		UiKit.icon(self, kind, center, icon_size, Palette.ON_INK)
	elif not running and index == selected:
		UiKit.fill_chamfer(self, rect, Palette.INK)
		UiKit.icon(self, kind, center, icon_size, Palette.ON_INK)
	else:
		UiKit.fill_chamfer(self, rect, Palette.FLOOR)
		UiKit.outline_chamfer(self, rect, Palette.INK)
		UiKit.icon(self, kind, center, icon_size, Palette.INK)


## The count tile of a loop. Editing: "x3", solid when selected. Running: "round/count" once the
## loop has started, "x3" before it.
func _draw_count(index: int, rect: Rect2) -> void:
	var cell := cells[index]
	var loop := int((cell["path"] as Array)[0])
	var count := int(cell["count"])
	var text := "\u00d7%d" % count
	var solid := not running and index == selected
	if running and current >= 0:
		var here := int((cells[current]["path"] as Array)[0])
		if loop < here:
			text = "%d/%d" % [count, count]
			solid = true
		elif loop == here:
			text = "%d/%d" % [maxi(current_round, 1), count]
			solid = true
	if solid:
		UiKit.fill_chamfer(self, rect, Palette.INK)
	else:
		UiKit.fill_chamfer(self, rect, Palette.FLOOR)
		UiKit.outline_chamfer(self, rect, Palette.INK)
	var color := Palette.ON_INK if solid else Palette.INK
	UiKit.text(self, text, rect, int(rect.size.x * 0.42), color, 0)


func _draw_head() -> void:
	var x := size.x / 2.0
	var tip := Vector2(x, 18.0)
	var points := PackedVector2Array([Vector2(x - 8.0, 4.0), Vector2(x + 8.0, 4.0), tip])
	draw_colored_polygon(points, Palette.SIGNAL)
	points.append(points[0])
	draw_polyline(points, Palette.INK, 2.0)


static func _icon_for(op: String) -> String:
	match op:
		"TURN_LEFT":
			return "left"
		"TURN_RIGHT":
			return "right"
		_:
			return "move"
