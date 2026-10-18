class_name BoardView
extends Control
## Draws a level's board: floor, hatched walls, the target, the trail, and the automaton.
## It only displays what it is given. The play screen sets `automaton` (a cell position that
## may be fractional while a move is animated), `facing`, `trail`, and `hit_wall`.

const GAP := 2.0

var level: Dictionary = {}
var automaton := Vector2.ZERO:
	set(value):
		automaton = value
		queue_redraw()
var facing := "north"
var trail: Array[Vector2i] = []
var hit_wall: Variant = null
## Small offset in cells for the blocked-move nudge.
var nudge := Vector2.ZERO:
	set(value):
		nudge = value
		queue_redraw()


func set_level(level_data: Dictionary) -> void:
	level = level_data
	show_state(
		level["initialState"]["position"],
		level["initialState"]["direction"],
		[] as Array[Vector2i],
		null
	)


## Shows a state without animation.
func show_state(
	position: Array, direction: String, passed: Array[Vector2i], blocked: Variant
) -> void:
	automaton = Vector2(int(position[0]), int(position[1]))
	facing = direction
	trail = passed
	hit_wall = blocked
	nudge = Vector2.ZERO
	queue_redraw()


## Side of one cell and the top-left corner of the grid, fitted and centered in this control.
func layout() -> Dictionary:
	var cols := int(level["board"]["width"])
	var rows := int(level["board"]["height"])
	var cell := minf((size.x - GAP * (cols - 1)) / cols, (size.y - GAP * (rows - 1)) / rows)
	cell = floorf(cell)
	var grid := Vector2(cell * cols + GAP * (cols - 1), cell * rows + GAP * (rows - 1))
	return {"cell": cell, "origin": ((size - grid) / 2.0).floor()}


func cell_rect(cell: Vector2, geometry: Dictionary) -> Rect2:
	var side: float = geometry["cell"]
	var origin: Vector2 = geometry["origin"]
	return Rect2(origin + cell * (side + GAP), Vector2(side, side))


func _draw() -> void:
	if level.is_empty():
		return
	var geometry := layout()
	var board: Dictionary = level["board"]
	var walls := {}
	for wall: Array in board["walls"]:
		walls[Vector2i(int(wall[0]), int(wall[1]))] = true
	var goal_cell: Array = level["goal"]["position"]
	var goal := Vector2i(int(goal_cell[0]), int(goal_cell[1]))
	var here := Vector2i(roundi(automaton.x), roundi(automaton.y))

	for y in int(board["height"]):
		for x in int(board["width"]):
			var point := Vector2i(x, y)
			var rect := cell_rect(Vector2(x, y), geometry)
			if walls.has(point):
				_draw_wall(rect, hit_wall != null and hit_wall == point)
			elif point == goal:
				_draw_goal(rect)
			elif trail.has(point) and point != here:
				_draw_trail(rect)
			else:
				draw_rect(rect, Palette.FLOOR)
	_draw_automaton(geometry)


func _draw_wall(rect: Rect2, hit: bool) -> void:
	draw_rect(rect, Palette.WALL)
	if hit:
		UiKit.hatch(self, rect, Palette.SIGNAL, rect.size.x * 0.34, rect.size.x * 0.17)
	else:
		UiKit.hatch(self, rect, Palette.WALL_HATCH, rect.size.x * 0.26, rect.size.x * 0.12)


func _draw_goal(rect: Rect2) -> void:
	draw_rect(rect, Palette.SIGNAL)
	var center := rect.get_center()
	var radius := rect.size.x * 0.27
	draw_arc(center, radius, 0.0, TAU, 32, Palette.ON_SIGNAL, maxf(2.0, rect.size.x * 0.07))
	draw_circle(center, radius * 0.38, Palette.ON_SIGNAL)


func _draw_trail(rect: Rect2) -> void:
	draw_rect(rect, Palette.TRAIL)
	var marker := rect.size.x * 0.16
	var box := Rect2(rect.get_center() - Vector2(marker, marker) / 2.0, Vector2(marker, marker))
	draw_rect(box.grow(2.0), Palette.INK)
	draw_rect(box, Palette.SIGNAL)


func _draw_automaton(geometry: Dictionary) -> void:
	var rect := cell_rect(automaton + nudge, geometry)
	var body := Rect2(rect.position + rect.size * 0.15, rect.size * 0.7)
	UiKit.fill_chamfer(self, body, Palette.INK)
	var direction: Vector2 = Vector2(
		ContractLimits.DIRECTION_DELTAS[facing][0], ContractLimits.DIRECTION_DELTAS[facing][1]
	)
	var center := body.get_center()
	var length := body.size.x * 0.4
	var across := body.size.x * 0.46
	var tip := center + direction * length * 0.9
	var base := center - direction * length * 0.5
	var side := Vector2(-direction.y, direction.x) * across / 2.0
	var wedge := PackedVector2Array([tip, base + side, base - side])
	draw_colored_polygon(wedge, Palette.SIGNAL)
	var outline := wedge.duplicate()
	outline.append(wedge[0])
	draw_polyline(outline, Palette.ON_INK, 1.5)
