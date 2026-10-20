class_name TapeModel
extends TapeOpen
## The player's program: a list of nodes, each a primitive, a loop (a count or "until" and a body
## of primitives and IFs), an IF (a sensor and two branches of primitives), a procedure definition
## (a name and a body of primitives, IFs and loops) or a CALL, with one optional selected tile.
## Pure data: no UI. The simulator receives `program()`. Definitions always come first in the list,
## so a procedure's index in the program is also its index on the tape.
##
## The tape shows one cell per slot: a primitive is one cell, a loop is a header cell then one
## cell per body slot, and an IF is a header cell (its sensor) then its then and else cells with
## a divider between them (the divider is not a slot); see TapeCells. `selected` is the index of
## a cell. A loop or IF being built takes the commands that are appended until `end_loop` or
## `end_if`; an IF can be open inside an open loop, and the loop closes last. A definition is
## built the same way (`end_proc`) and takes loops and IFs of its own; no CALL goes into one
## (docs/README_GAME_RULES.md sections 3.1 to 3.4).
##
## Which loop or IF is open is a flag inside its node ("_open", and "_branch" on an IF), so it
## follows the node when the tape is edited. `program()` leaves the flags out.


func _init(max_commands: int = 0, available_commands: Array[String] = []) -> void:
	limit = max_commands
	available = available_commands


## Whether `append(op)` would be accepted.
func can_append(op: String) -> bool:
	if not available.has(op) or is_full():
		return false
	var node := open_if()
	if op == PROC:
		return open_chain().is_empty() and next_proc_name() != ""
	if ContractLimits.is_loop(op):
		return open_loop_path().is_empty() and node.is_empty() and not open_loop_is_full()
	if op == IF:
		return node.is_empty() and not open_loop_is_full()
	if not node.is_empty():
		return (node[open_branch()] as Array).size() < ContractLimits.IF_THEN_MAX
	return not open_loop_is_full()


## Whether `append_call(name)` would be accepted: the level offers PROC, the name is defined, and
## the call has a place (the main program or an open loop of it, never a definition or an IF).
func can_call(name: String) -> bool:
	if not available.has(PROC) or is_full() or not defined_names().has(name):
		return false
	if open_proc() >= 0 or not open_if().is_empty():
		return false
	return not open_loop_is_full()


## Adds a CALL of `name` to the open main-program loop, else at the end of the program.
func append_call(name: String) -> bool:
	if not can_call(name):
		return false
	selected = -1
	var container := _open_container()
	var list: Array = nodes if container.is_empty() else container["body"]
	list.append({"op": CALL, "name": name})
	return true


## Adds a command: into the open IF branch, else the open loop, else the open definition, else at
## the end. REPEAT starts a loop and selects its count, IF starts an IF (sensor ahead) and selects
## its sensor cell, REPEAT_UNTIL starts a loop and, when the level offers IF (its condition can
## then be GOAL), selects its header, PROC starts the next free definition (at the start of the
## tape) and selects its header; otherwise nothing is selected. False when the tape is full, the
## command is not offered, or there is no room (see can_append).
func append(op: String) -> bool:
	if not can_append(op):
		return false
	var node := {"op": op}
	selected = -1
	if op == REPEAT:
		node = {"op": REPEAT, "count": ContractLimits.REPEAT_COUNT_MIN, "body": [], "_open": true}
	elif op == REPEAT_UNTIL:
		node = {
			"op": REPEAT_UNTIL,
			"until": ContractLimits.UNTIL_CONDITIONS[0],
			"body": [],
			"_open": true
		}
	elif op == IF:
		node = {
			"op": IF,
			"when": ContractLimits.SENSORS[0],
			"then": [],
			"else": [],
			"_open": true,
			"_branch": "then"
		}
	elif op == PROC:
		var at := defined_names().size()
		nodes.insert(at, {"op": PROC, "name": next_proc_name(), "body": [], "_open": true})
		selected = cell_for_node([at])
		return true
	var target := open_if()
	if not target.is_empty():
		(target[open_branch()] as Array).append(node)
		return true
	var container := _open_container()
	var in_container := not container.is_empty()
	var list: Array = container["body"] if in_container else nodes
	list.append(node)
	var selects := op == REPEAT or op == IF or (op == REPEAT_UNTIL and available.has(IF))
	if selects:
		var path: Array = open_chain().back() if ContractLimits.is_loop(op) or op == IF else []
		selected = cell_for_node(path)
	return true


## Stops adding to the open loop. False when none is open, it has no item or an IF is still open.
func end_loop() -> bool:
	if not can_end_loop():
		return false
	TapeCells.node_at(nodes, open_loop_path()).erase("_open")
	selected = -1
	return true


## Stops adding to the open definition. False when none is open or it has no item.
func end_proc() -> bool:
	if not can_end_proc():
		return false
	nodes[open_proc()].erase("_open")
	selected = -1
	return true


## Stops adding to the open IF. False when none is open or its then branch has no command.
func end_if() -> bool:
	if not can_end_if():
		return false
	var node := open_if()
	node.erase("_open")
	node.erase("_branch")
	selected = -1
	return true


## Switches the open IF to its else branch.
func start_else() -> bool:
	if not can_start_else():
		return false
	open_if()["_branch"] = "else"
	selected = -1
	return true


func _else_showing() -> String:
	return open_if_key() if open_branch() == "else" else ""


## The `iff` key (see TapeCells) of the open IF, or "".
func open_if_key() -> String:
	for cell in TapeCells.build(nodes):
		if cell["kind"] == "if" and node_of(cell).get("_open", false):
			return String(cell["iff"])
	return ""
