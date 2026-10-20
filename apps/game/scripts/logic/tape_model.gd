class_name TapeModel
extends TapeEdit
## The player's program: a list of nodes, each a primitive, a loop (a count or "until" and a body
## of primitives and IFs) or an IF (a sensor and two branches of primitives), with one optional
## selected tile. Pure data: no UI. The simulator receives `program()`.
##
## The tape shows one cell per slot: a primitive is one cell, a loop is a header cell then one
## cell per body slot, and an IF is a header cell (its sensor) then its then and else cells with
## a divider between them (the divider is not a slot); see TapeCells. `selected` is the index of
## a cell. A loop or IF being built takes the commands that are appended until `end_loop` or
## `end_if`; an IF can be open inside an open loop, and the loop closes last
## (docs/README_GAME_RULES.md sections 3.1 to 3.3).
##
## Which loop or IF is open is a flag inside its node ("_open", and "_branch" on an IF), so it
## follows the node when the tape is edited. `program()` leaves the flags out.

const REPEAT := ContractLimits.REPEAT_OP
const REPEAT_UNTIL := ContractLimits.REPEAT_UNTIL_OP
const IF := ContractLimits.IF_OP

var limit := 0
var available: Array[String] = []


func _init(max_commands: int = 0, available_commands: Array[String] = []) -> void:
	limit = max_commands
	available = available_commands


## Slots used: this is what the limit counts (see ProgramSlots).
func slots() -> int:
	return ProgramSlots.count(nodes)


func is_full() -> bool:
	return limit > 0 and slots() >= limit


## True when a loop has no item or an IF has no then command. Such a tape is not a program.
func is_incomplete() -> bool:
	return TapeCells.has_empty_loop(nodes) or TapeCells.has_empty_if(nodes)


func has_empty_loop() -> bool:
	return TapeCells.has_empty_loop(nodes)


## The program index of the loop that is open, or -1.
func open_loop() -> int:
	for i in nodes.size():
		if ContractLimits.is_loop(nodes[i]["op"]) and nodes[i].get("_open", false):
			return i
	return -1


## The IF that is open (a node of the tape), or an empty Dictionary.
func open_if() -> Dictionary:
	for node: Dictionary in nodes:
		if ContractLimits.is_if(node["op"]) and node.get("_open", false):
			return node
		if ContractLimits.is_loop(node["op"]):
			for item: Dictionary in node["body"]:
				if ContractLimits.is_if(item["op"]) and item.get("_open", false):
					return item
	return {}


## "then" or "else" while an IF is open, else "".
func open_branch() -> String:
	return String(open_if().get("_branch", ""))


## True while the open loop is at the most items a body may hold.
func open_loop_is_full() -> bool:
	var loop := open_loop()
	return loop >= 0 and (nodes[loop]["body"] as Array).size() >= ContractLimits.REPEAT_BODY_MAX


## True when `end_loop` would be accepted: a loop is open, has an item, and no IF is open in it.
func can_end_loop() -> bool:
	var loop := open_loop()
	return loop >= 0 and not (nodes[loop]["body"] as Array).is_empty() and open_if().is_empty()


## True when `end_if` would be accepted: an IF is open and its then branch has a command.
func can_end_if() -> bool:
	var node := open_if()
	return not node.is_empty() and not (node["then"] as Array).is_empty()


## True when `start_else` would be accepted: an IF is open on its then branch, which has a command.
func can_start_else() -> bool:
	return can_end_if() and open_branch() == "then"


## Whether `append(op)` would be accepted.
func can_append(op: String) -> bool:
	if not available.has(op) or is_full():
		return false
	var node := open_if()
	if ContractLimits.is_loop(op):
		return open_loop() < 0 and node.is_empty()
	if op == IF:
		return node.is_empty() and not open_loop_is_full()
	if not node.is_empty():
		return (node[open_branch()] as Array).size() < ContractLimits.IF_THEN_MAX
	return not open_loop_is_full()


## Adds a command: into the open IF branch, else the open loop, else at the end. REPEAT starts a
## loop and selects its count, IF starts an IF (sensor ahead) and selects its sensor cell,
## REPEAT_UNTIL starts a loop and, when the level offers IF (its condition can then be GOAL),
## selects its header; otherwise nothing is selected. False when the tape is full, the command is
## not offered, or there is no room (see can_append).
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
	var target := open_if()
	if not target.is_empty():
		(target[open_branch()] as Array).append(node)
		return true
	var loop := open_loop()
	var in_loop := loop >= 0 and not ContractLimits.is_loop(op)
	var list: Array = nodes[loop]["body"] if in_loop else nodes
	list.append(node)
	if op == REPEAT or op == IF or (op == REPEAT_UNTIL and available.has(IF)):
		var path: Array = [loop, list.size() - 1] if in_loop else [list.size() - 1]
		selected = cell_for_node(path)
	return true


## Stops adding to the open loop. False when none is open, it has no item or an IF is still open.
func end_loop() -> bool:
	if not can_end_loop():
		return false
	nodes[open_loop()].erase("_open")
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
