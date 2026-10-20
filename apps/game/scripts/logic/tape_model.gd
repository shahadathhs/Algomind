class_name TapeModel
extends RefCounted
## The player's program: a list of nodes, each a primitive or a loop (a count and a body of
## primitives), with one optional selected tile. Pure data: no UI. The simulator receives
## `program()`.
##
## The tape shows one cell per slot: a primitive is one cell, a loop is a header cell (a count
## for REPEAT, "until blocked" for REPEAT_UNTIL) then one cell per body command.
## `selected` is the index of a cell. A loop being built takes the commands that are appended
## until `end_loop` (a loop cannot hold a loop; see docs/README_GAME_RULES.md sections 3.1, 3.2).

const REPEAT := ContractLimits.REPEAT_OP
const REPEAT_UNTIL := ContractLimits.REPEAT_UNTIL_OP

var nodes: Array = []
## Index of the selected cell, or -1.
var selected := -1
var limit := 0
var available: Array[String] = []

## Index in `nodes` of the loop that takes appended commands, or -1.
var _open := -1


func _init(max_commands: int = 0, available_commands: Array[String] = []) -> void:
	limit = max_commands
	available = available_commands


## Slots used: a primitive is 1, a loop is 1 plus its body. This is what the limit counts.
func slots() -> int:
	var total := 0
	for node: Dictionary in nodes:
		total += 1
		if ContractLimits.is_loop(node["op"]):
			total += (node["body"] as Array).size()
	return total


func is_empty() -> bool:
	return nodes.is_empty()


func is_full() -> bool:
	return limit > 0 and slots() >= limit


## True when the open loop has no command yet. Such a loop is not a valid program.
func has_empty_loop() -> bool:
	for node: Dictionary in nodes:
		if ContractLimits.is_loop(node["op"]) and (node["body"] as Array).is_empty():
			return true
	return false


## True while the open loop is at the most commands a body may hold.
func open_loop_is_full() -> bool:
	return _open >= 0 and (nodes[_open]["body"] as Array).size() >= ContractLimits.REPEAT_BODY_MAX


## True when `end_loop` would be accepted: a loop is open and has at least one command.
func can_end_loop() -> bool:
	return _open >= 0 and not (nodes[_open]["body"] as Array).is_empty()


## Whether `append(op)` would be accepted.
func can_append(op: String) -> bool:
	if not available.has(op) or is_full():
		return false
	if ContractLimits.is_loop(op):
		return _open < 0
	return not open_loop_is_full()


## Adds a command: into the open loop if there is one, else at the end. REPEAT starts a loop and
## selects its count; REPEAT_UNTIL starts a loop with nothing to select. False when the tape is
## full, the command is not offered, a loop is already open (either kind) or the open loop's body
## is full.
func append(op: String) -> bool:
	if not can_append(op):
		return false
	if op == REPEAT:
		nodes.append({"op": REPEAT, "count": ContractLimits.REPEAT_COUNT_MIN, "body": []})
		_open = nodes.size() - 1
		selected = cell_for_node([_open])
		return true
	if op == REPEAT_UNTIL:
		nodes.append({"op": REPEAT_UNTIL, "until": "BLOCKED", "body": []})
		_open = nodes.size() - 1
		selected = -1
		return true
	if _open >= 0:
		(nodes[_open]["body"] as Array).append({"op": op})
	else:
		nodes.append({"op": op})
	selected = -1
	return true


## Stops adding to the open loop. False when no loop is open or it has no command yet.
func end_loop() -> bool:
	if not can_end_loop():
		return false
	_open = -1
	selected = -1
	return true


## The cells the tape shows, in order. Each is { kind, op, path, count, body }:
## kind "op" (a primitive, at the top level or in a body), "count" (the start of a REPEAT) or
## "until" (the start of a REPEAT_UNTIL). `path` is [i] or [i, j] into the program; `body` is set
## on both header kinds and `count` on "count" cells.
func cells() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for i in nodes.size():
		var node: Dictionary = nodes[i]
		if node["op"] == REPEAT:
			var body: Array = node["body"]
			out.append(
				{
					"kind": "count",
					"op": REPEAT,
					"path": [i],
					"count": int(node["count"]),
					"body": body.size()
				}
			)
			for j in body.size():
				out.append({"kind": "op", "op": body[j]["op"], "path": [i, j]})
		elif node["op"] == REPEAT_UNTIL:
			var until_body: Array = node["body"]
			out.append(
				{"kind": "until", "op": REPEAT_UNTIL, "path": [i], "body": until_body.size()}
			)
			for j in until_body.size():
				out.append({"kind": "op", "op": until_body[j]["op"], "path": [i, j]})
		else:
			out.append({"kind": "op", "op": node["op"], "path": [i]})
	return out


## The cell index for a node path ([i] or [i, j]), or -1.
func cell_for_node(path: Array) -> int:
	var all := cells()
	for k in all.size():
		var cell_path: Array = all[k]["path"]
		if cell_path == path:
			return k
	return -1


## The program index of the loop that is open, or -1.
func open_loop() -> int:
	return _open


## Selects a cell; selecting the selected cell again clears the selection.
func toggle_select(index: int) -> void:
	if index < 0 or index >= cells().size() or index == selected:
		selected = -1
	else:
		selected = index


func clear_selection() -> void:
	selected = -1


func selected_is_count() -> bool:
	return selected >= 0 and cells()[selected]["kind"] == "count"


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


## Removes the selected cell: a primitive, or a whole loop when its count cell is selected.
func remove_selected() -> bool:
	if selected < 0:
		return false
	var path: Array = cells()[selected]["path"]
	if path.size() == 2:
		(nodes[int(path[0])]["body"] as Array).remove_at(int(path[1]))
	else:
		var index := int(path[0])
		nodes.remove_at(index)
		if _open == index:
			_open = -1
		elif _open > index:
			_open -= 1
	selected = -1
	return true


## Moves the selected cell one place earlier (-1) or later (1) among its siblings: a top-level
## cell or a loop (with its body) among the top level, a body command within its body. The
## selection follows it.
func move_selected(direction: int) -> bool:
	if selected < 0:
		return false
	var path: Array = cells()[selected]["path"]
	if path.size() == 2:
		var body: Array = nodes[int(path[0])]["body"]
		var j := int(path[1])
		var target := j + direction
		if target < 0 or target >= body.size():
			return false
		var item: Dictionary = body[j]
		body[j] = body[target]
		body[target] = item
		selected = cell_for_node([int(path[0]), target])
		return true
	var i := int(path[0])
	var next := i + direction
	if next < 0 or next >= nodes.size():
		return false
	var node: Dictionary = nodes[i]
	nodes[i] = nodes[next]
	nodes[next] = node
	if _open == i:
		_open = next
	elif _open == next:
		_open = i
	selected = cell_for_node([next])
	return true


func clear() -> void:
	nodes.clear()
	_open = -1
	selected = -1


## The program in the simulator's format: a list of instruction nodes (copies).
func program() -> Array:
	var out: Array = []
	for node: Dictionary in nodes:
		if ContractLimits.is_loop(node["op"]):
			var body: Array = []
			for item: Dictionary in node["body"]:
				body.append({"op": item["op"]})
			if node["op"] == REPEAT:
				out.append({"op": REPEAT, "count": int(node["count"]), "body": body})
			else:
				out.append({"op": REPEAT_UNTIL, "until": node["until"], "body": body})
		else:
			out.append({"op": node["op"]})
	return out
