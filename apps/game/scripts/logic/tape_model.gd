class_name TapeModel
extends RefCounted
## The player's program as an ordered list of command names, with one optional selected tile.
## Pure data: no UI. The simulator receives `program()`.

var ops: Array[String] = []
## Index of the selected tile, or -1.
var selected := -1
var limit := 0
var available: Array[String] = []


func _init(max_commands: int = 0, available_commands: Array[String] = []) -> void:
	limit = max_commands
	available = available_commands


func size() -> int:
	return ops.size()


func is_full() -> bool:
	return limit > 0 and ops.size() >= limit


## Adds a command at the end. False when the tape is full or the command is not offered.
func append(op: String) -> bool:
	if is_full() or not available.has(op):
		return false
	ops.append(op)
	selected = -1
	return true


## Selects a tile; selecting the selected tile again clears the selection.
func toggle_select(index: int) -> void:
	if index < 0 or index >= ops.size() or index == selected:
		selected = -1
	else:
		selected = index


func clear_selection() -> void:
	selected = -1


func remove_selected() -> bool:
	if selected < 0:
		return false
	ops.remove_at(selected)
	selected = -1
	return true


## Moves the selected tile one place earlier (-1) or later (1). The selection follows the tile.
func move_selected(direction: int) -> bool:
	var target := selected + direction
	if selected < 0 or target < 0 or target >= ops.size():
		return false
	var op := ops[selected]
	ops[selected] = ops[target]
	ops[target] = op
	selected = target
	return true


func clear() -> void:
	ops.clear()
	selected = -1


## The program in the simulator's format: a list of instruction nodes.
func program() -> Array:
	var nodes: Array = []
	for op in ops:
		nodes.append({"op": op})
	return nodes
