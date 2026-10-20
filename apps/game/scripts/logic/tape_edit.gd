class_name TapeEdit
extends RefCounted
## The part of the tape that edits what is already there: the cells, the selection and the
## changes to the selected cell. TapeModel adds building (open loops and IFs). Pure data.

var nodes: Array = []
## Index of the selected cell, or -1.
var selected := -1


func is_empty() -> bool:
	return nodes.is_empty()


## The cells the tape shows, in order (see TapeCells).
func cells() -> Array[Dictionary]:
	return TapeCells.build(nodes, _else_showing())


## The cell index for a node path ([i], [i, j], [i, k] or [i, j, k]), or -1.
func cell_for_node(path: Array) -> int:
	var all := cells()
	for k in all.size():
		var cell_path: Array = all[k]["path"]
		if cell_path == path:
			return k
	return -1


## Selects a cell; selecting the selected cell again clears the selection. An else divider cannot
## be selected.
func toggle_select(index: int) -> void:
	var all := cells()
	if index < 0 or index >= all.size() or index == selected:
		selected = -1
	elif all[index]["kind"] != "else":
		selected = index


func clear_selection() -> void:
	selected = -1


func selected_is_count() -> bool:
	return selected >= 0 and cells()[selected]["kind"] == "count"


## The kind of the selected cell (see TapeCells), or "" when nothing is selected.
func selected_kind() -> String:
	return "" if selected < 0 else String(cells()[selected]["kind"])


## Changes the count of the selected loop by `delta`, within the allowed range.
func adjust_count(delta: int) -> bool:
	if not selected_is_count():
		return false
	var loop := int((cells()[selected]["path"] as Array)[0])
	var next := clampi(
		int(nodes[loop]["count"]) + delta,
		ContractLimits.REPEAT_COUNT_MIN,
		ContractLimits.REPEAT_COUNT_MAX
	)
	if next == int(nodes[loop]["count"]):
		return false
	nodes[loop]["count"] = next
	return true


## Moves the selected IF to its next sensor (ahead, left, right, ahead) or the selected
## REPEAT_UNTIL to its next condition (BLOCKED, GOAL, BLOCKED).
func cycle_condition() -> bool:
	var kind := selected_kind()
	if kind != "if" and kind != "until":
		return false
	var node := node_of(cells()[selected])
	var key := "when" if kind == "if" else "until"
	var options: Array[String] = (
		ContractLimits.SENSORS if kind == "if" else ContractLimits.UNTIL_CONDITIONS
	)
	node[key] = options[(options.find(node[key]) + 1) % options.size()]
	return true


## The list (the program, a loop body or an IF branch) that holds the cell's node.
func siblings_of(cell: Dictionary) -> Array:
	return TapeCells.siblings_of(nodes, cell)


func position_of(cell: Dictionary) -> int:
	return TapeCells.position_of(cell)


## The node a cell stands for: a primitive, a loop (its header) or an IF (its header).
func node_of(cell: Dictionary) -> Dictionary:
	return siblings_of(cell)[position_of(cell)]


## Removes the selected cell: a primitive, or a whole loop or IF when its header is selected.
func remove_selected() -> bool:
	if selected < 0:
		return false
	var cell := cells()[selected]
	siblings_of(cell).remove_at(position_of(cell))
	selected = -1
	return true


## True when the selected cell can move one place earlier (-1) or later (1): it stays inside its
## list, and a definition never leaves the start of the program or a main node enters it.
func can_move(direction: int) -> bool:
	if selected < 0:
		return false
	var cell := cells()[selected]
	var list := siblings_of(cell)
	var target := position_of(cell) + direction
	if target < 0 or target >= list.size():
		return false
	if (cell["path"] as Array).size() > 1:
		return true
	return (list[target]["op"] == "PROC") == (list[position_of(cell)]["op"] == "PROC")


## Moves the selected cell one place earlier (-1) or later (1) among its siblings: a node among
## the program or a loop body, a command within its IF branch. A loop or IF moves with its
## contents. The selection follows it.
func move_selected(direction: int) -> bool:
	if selected < 0:
		return false
	var cell := cells()[selected]
	var list := siblings_of(cell)
	var place := position_of(cell)
	if not can_move(direction):
		return false
	var target := place + direction
	var item: Dictionary = list[place]
	list[place] = list[target]
	list[target] = item
	var path: Array = (cell["path"] as Array).duplicate()
	path[path.size() - 1] = int(path.back()) + direction
	selected = cell_for_node(path)
	return true


func clear() -> void:
	nodes.clear()
	selected = -1


## The program in the simulator's format: a list of instruction nodes (copies).
func program() -> Array:
	return TapeCells.program_of(nodes)


## The `iff` key of the IF whose else divider must show although its else is empty; "" for none.
func _else_showing() -> String:
	return ""
