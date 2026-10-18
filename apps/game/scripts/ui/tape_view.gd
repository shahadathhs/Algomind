class_name TapeView
extends Control
## The tape: a strip of instruction tiles.
##
## Editing: left-aligned, a dashed plus slot at the end, drag to scroll when it overflows.
## Running: a fixed read-head at the center; `scroll` is animated by the play screen so the
## current tile sits under it. States per tile: executed (solid), current (yellow), upcoming
## (outlined), failed (yellow with an X). The view only displays; it never runs anything.

signal tile_tapped(index: int)

const PAD := 12.0
const DRAG_SLOP := 10.0

var ops: Array[String] = []
var limit := 0
var selected := -1
## False while editing; true when the read-head is shown.
var running := false
## Index of the tile under the read-head, or -1 before the first step.
var current := -1
var failed_index := -1
## Horizontal offset of the strip in pixels.
var scroll := 0.0:
	set(value):
		scroll = value
		queue_redraw()

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


func set_content(tape_ops: Array[String], max_commands: int, selected_index: int) -> void:
	ops = tape_ops
	limit = max_commands
	selected = selected_index
	queue_redraw()


## The scroll that shows the end of the program (the slot where the next tile goes).
func edit_scroll() -> float:
	var end_x := PAD + (ops.size() + 1) * pitch()
	return maxf(0.0, end_x - size.x)


## The scroll that puts tile `index` under the read-head at the center.
func head_scroll(index: int) -> float:
	return PAD + maxi(index, 0) * pitch() + tile_size() / 2.0 - size.x / 2.0


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
	var index := int(floor((point.x + scroll - PAD) / pitch()))
	var within := fposmod(point.x + scroll - PAD, pitch()) <= tile_size()
	if index < 0 or index >= ops.size() or not within:
		return -1
	return index


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Palette.STRIP)
	var tile := tile_size()
	var top := 22.0 if running else 12.0
	for i in ops.size():
		var rect := Rect2(Vector2(PAD + i * pitch() - scroll, top), Vector2(tile, tile))
		if rect.end.x < 0.0 or rect.position.x > size.x:
			continue
		_draw_tile(i, rect)
		var number := "%02d" % (i + 1)
		var number_rect := Rect2(rect.position.x, rect.end.y + 2.0, tile, 22.0)
		var number_color := Palette.INK if i == current and running else Palette.MUTE
		UiKit.text(self, number, number_rect, 14, number_color, 1)
	if not running and ops.size() < limit:
		var slot := Rect2(Vector2(PAD + ops.size() * pitch() - scroll, top), Vector2(tile, tile))
		UiKit.outline_chamfer(self, slot, Palette.SLOT, 2.0, true)
		UiKit.icon(self, "plus", slot.get_center(), tile * 0.5, Palette.SLOT)
	if running:
		_draw_head()


func _draw_tile(index: int, rect: Rect2) -> void:
	var op := ops[index]
	var kind := _icon_for(op)
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
