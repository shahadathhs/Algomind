class_name TapeCells
extends RefCounted
## The cells the tape shows for a list of program nodes (see TapeModel). Pure data.
##
## Every cell is { kind, op, path, loop, iff } plus:
## - kind "op": a primitive. `path` is the node's trace path ([i], [i, j] in a loop body, [i, k] in
##   an IF at the top level, [i, j, k] in an IF in a loop body; k counts the then primitives
##   first). Primitives in an IF also have `branch` ("then" or "else") and `pos` (index in it).
## - kind "count" / "until": the first cell of a loop; `body` is its number of items, `count`
##   is set on "count" and `until` (BLOCKED or GOAL) on "until".
## - kind "if": the first cell of an IF; `when` is its sensor.
## - kind "else": the divider between the then and else tiles of an IF (not a slot).
## `loop` is the index of the loop the cell belongs to (-1 outside loops) and `iff` identifies the
## IF it belongs to (its path joined with "_", "" outside IFs).

const REPEAT := ContractLimits.REPEAT_OP
const REPEAT_UNTIL := ContractLimits.REPEAT_UNTIL_OP
const IF := ContractLimits.IF_OP


## `showing_else` is the `iff` key of an IF whose else divider shows although its else is empty.
static func build(nodes: Array, showing_else: String = "") -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for i in nodes.size():
		var node: Dictionary = nodes[i]
		if not ContractLimits.is_loop(node["op"]):
			_add_item(out, node, [i], -1, showing_else)
			continue
		var body: Array = node["body"]
		var header := {"kind": "until", "op": node["op"], "path": [i], "loop": i, "iff": ""}
		header["body"] = body.size()
		header["until"] = String(node.get("until", ""))
		if node["op"] == ContractLimits.REPEAT_OP:
			header["kind"] = "count"
			header["count"] = int(node["count"])
		out.append(header)
		for j in body.size():
			_add_item(out, body[j], [i, j], i, showing_else)
	return out


static func key_of(path: Array) -> String:
	var parts := PackedStringArray()
	for part: Variant in path:
		parts.append(str(part))
	return "_".join(parts)


static func _add_item(
	out: Array[Dictionary], item: Dictionary, path: Array, loop: int, showing_else: String
) -> void:
	if not ContractLimits.is_if(item["op"]):
		out.append({"kind": "op", "op": item["op"], "path": path, "loop": loop, "iff": ""})
		return
	var key := key_of(path)
	out.append(
		{"kind": "if", "op": "IF", "path": path, "loop": loop, "iff": key, "when": item["when"]}
	)
	var then_list: Array = item["then"]
	var else_list: Array = item["else"]
	for k in then_list.size():
		out.append(_branch_cell(then_list[k], path, k, k, "then", loop, key))
	if not else_list.is_empty() or showing_else == key:
		out.append({"kind": "else", "op": "IF", "path": path, "loop": loop, "iff": key})
	for k in else_list.size():
		out.append(_branch_cell(else_list[k], path, then_list.size() + k, k, "else", loop, key))


static func _branch_cell(
	item: Dictionary, path: Array, trace_k: int, pos: int, branch: String, loop: int, key: String
) -> Dictionary:
	var cell_path := path.duplicate()
	cell_path.append(trace_k)
	return {
		"kind": "op",
		"op": item["op"],
		"path": cell_path,
		"loop": loop,
		"iff": key,
		"branch": branch,
		"pos": pos,
	}


## The list (the program, a loop body or an IF branch) that holds the cell's node.
static func siblings_of(nodes: Array, cell: Dictionary) -> Array:
	var path: Array = cell["path"]
	if cell.has("branch"):
		var owner: Array = path.slice(0, path.size() - 1)
		var node: Dictionary = (
			nodes[int(owner[0])]
			if owner.size() == 1
			else nodes[int(owner[0])]["body"][int(owner[1])]
		)
		return node[cell["branch"]]
	return nodes if path.size() == 1 else nodes[int(path[0])]["body"]


## The position of the cell's node in siblings_of.
static func position_of(cell: Dictionary) -> int:
	return int(cell["pos"]) if cell.has("branch") else int((cell["path"] as Array).back())


## The nodes in the simulator's format: copies without the editing flags.
static func program_of(nodes: Array) -> Array:
	var out: Array = []
	for node: Dictionary in nodes:
		out.append(_plain(node))
	return out


static func _plain(node: Dictionary) -> Dictionary:
	var op: String = node["op"]
	if op == IF:
		return {
			"op": IF,
			"when": node["when"],
			"then": _plain_list(node["then"]),
			"else": _plain_list(node["else"]),
		}
	if op == REPEAT:
		return {"op": REPEAT, "count": int(node["count"]), "body": _plain_list(node["body"])}
	if op == REPEAT_UNTIL:
		return {"op": REPEAT_UNTIL, "until": node["until"], "body": _plain_list(node["body"])}
	return {"op": op}


static func _plain_list(list: Array) -> Array:
	return program_of(list)


## True when a loop has no item.
static func has_empty_loop(nodes: Array) -> bool:
	for node: Dictionary in nodes:
		if ContractLimits.is_loop(node["op"]) and (node["body"] as Array).is_empty():
			return true
	return false


## True when an IF (at the top level or in a loop body) has no then command.
static func has_empty_if(nodes: Array) -> bool:
	for node: Dictionary in nodes:
		var items: Array = node["body"] if ContractLimits.is_loop(node["op"]) else [node]
		for item: Dictionary in items:
			if ContractLimits.is_if(item["op"]) and (item["then"] as Array).is_empty():
				return true
	return false
