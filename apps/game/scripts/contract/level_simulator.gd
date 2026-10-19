class_name LevelSimulator
extends RefCounted
## Runs a program on a level. Pure and deterministic: no scene, clock, randomness, or I/O,
## and the inputs are never modified. Animation displays the returned trace.
##
## Mirrors packages/level-contract/src/simulate.ts. Expects a level that passed
## LevelValidator.validate_level and does not check availableCommands or maxCommands;
## callers run LevelValidator.validate_program first.
##
## Numbers: JSON parsing yields floats, so every coordinate is read with int(). Positions in
## the result are Arrays of two ints, [x, y], and blockedCell is such an Array or null.

const _LEFT := "TURN_LEFT"
const _RIGHT := "TURN_RIGHT"


## Rotates a direction name 90 degrees. "left" is counterclockwise, "right" clockwise.
static func turn(direction: String, side: String) -> String:
	var i := ContractLimits.DIRECTIONS.find(direction)
	var next := (i + (1 if side == "right" else 3)) % 4
	return ContractLimits.DIRECTIONS[next]


## The cell one step ahead of position [x, y] when facing direction. May lie outside the board.
static func cell_ahead(position: Array, direction: String) -> Array:
	var delta: Array = ContractLimits.DIRECTION_DELTAS[direction]
	return [int(position[0]) + int(delta[0]), int(position[1]) + int(delta[1])]


## True for one primitive node: an object whose op is MOVE_FORWARD, TURN_LEFT, or TURN_RIGHT.
static func _is_primitive(node: Variant) -> bool:
	return (
		typeof(node) == TYPE_DICTIONARY
		and typeof(node.get("op")) == TYPE_STRING
		and ContractLimits.PRIMITIVE_COMMANDS.has(node["op"])
	)


## True for a loop the simulator can run: a whole count in range and 1 to 8 primitives.
static func _is_runnable_repeat(node: Variant) -> bool:
	if typeof(node) != TYPE_DICTIONARY or not ContractLimits.is_repeat(node.get("op")):
		return false
	var count: Variant = node.get("count")
	if typeof(count) == TYPE_FLOAT:
		if count != floorf(count):
			return false
	elif typeof(count) != TYPE_INT:
		return false
	if int(count) < ContractLimits.REPEAT_COUNT_MIN or int(count) > ContractLimits.REPEAT_COUNT_MAX:
		return false
	var body: Variant = node.get("body")
	if typeof(body) != TYPE_ARRAY:
		return false
	var items: Array = body
	if (
		items.size() < ContractLimits.REPEAT_BODY_MIN
		or items.size() > ContractLimits.REPEAT_BODY_MAX
	):
		return false
	for item: Variant in items:
		if not _is_primitive(item):
			return false
	return true


## Runs program (an Array of instruction nodes) on level (parsed JSON Dictionary).
## Returns { status, reason, steps, finalState, blockedCell, trace }.
##
## Every executed primitive is one step; a REPEAT itself costs none. The step limit is checked
## before each node and before each primitive inside a loop. The run succeeds the moment the
## goal cell is entered, even in the middle of a loop.
static func simulate(level: Dictionary, program: Array) -> Dictionary:
	var board: Dictionary = level["board"]
	var walls := {}
	for wall: Array in board["walls"]:
		walls[Vector2i(int(wall[0]), int(wall[1]))] = true

	var initial: Dictionary = level["initialState"]
	var start: Array = initial["position"]
	var goal_cell: Array = level["goal"]["position"]
	# The run state lives in one Dictionary so that step() can change it.
	var run := {
		"width": int(board["width"]),
		"height": int(board["height"]),
		"walls": walls,
		"goal": Vector2i(int(goal_cell[0]), int(goal_cell[1])),
		"position": [int(start[0]), int(start[1])],
		"direction": String(initial["direction"]),
		"trace": [],
	}
	var max_steps := int(level["constraints"]["maxSteps"])

	for i in program.size():
		var node: Variant = program[i]
		if (run["trace"] as Array).size() >= max_steps:
			return _finish("FAILED", "STEP_LIMIT", null, run)

		if _is_primitive(node):
			var result: Variant = _step(run, String(node["op"]), [i], null)
			if result != null:
				return result
			continue
		if not _is_runnable_repeat(node):
			return _finish("FAILED", "INVALID_INSTRUCTION", null, run)

		var body: Array = node["body"]
		for round_number in range(1, int(node["count"]) + 1):
			for j in body.size():
				if (run["trace"] as Array).size() >= max_steps:
					return _finish("FAILED", "STEP_LIMIT", null, run)
				var result: Variant = _step(run, String(body[j]["op"]), [i, j], round_number)
				if result != null:
					return result

	return _finish("FAILED", "PROGRAM_ENDED", null, run)


## Runs one primitive. Returns the final result Dictionary when the run ends here, else null.
static func _step(run: Dictionary, command: String, node: Array, round_number: Variant) -> Variant:
	var trace: Array = run["trace"]
	var position: Array = run["position"]
	var direction: String = run["direction"]
	var index := trace.size()
	if command == _LEFT or command == _RIGHT:
		run["direction"] = turn(direction, "left" if command == _LEFT else "right")
		trace.append(
			_entry(index, command, node, round_number, position, run["direction"], "TURNED")
		)
		return null

	# MOVE_FORWARD
	var target := cell_ahead(position, direction)
	var tx := int(target[0])
	var ty := int(target[1])
	if tx < 0 or ty < 0 or tx >= int(run["width"]) or ty >= int(run["height"]):
		trace.append(
			_entry(index, command, node, round_number, position, direction, "BLOCKED_BY_BOUNDARY")
		)
		return _finish("FAILED", "BLOCKED_BY_BOUNDARY", target, run)
	if (run["walls"] as Dictionary).has(Vector2i(tx, ty)):
		trace.append(
			_entry(index, command, node, round_number, position, direction, "BLOCKED_BY_WALL")
		)
		return _finish("FAILED", "BLOCKED_BY_WALL", target, run)

	run["position"] = target
	if Vector2i(tx, ty) == run["goal"]:
		trace.append(_entry(index, command, node, round_number, target, direction, "GOAL_REACHED"))
		return _finish("SUCCEEDED", "GOAL_REACHED", null, run)
	trace.append(_entry(index, command, node, round_number, target, direction, "MOVED"))
	return null


static func _entry(
	index: int,
	op: String,
	node: Array,
	round_number: Variant,
	position: Array,
	direction: String,
	event: String
) -> Dictionary:
	return {
		"index": index,
		"op": op,
		"node": node,
		"round": round_number,
		"position": [position[0], position[1]],
		"direction": direction,
		"event": event,
	}


static func _finish(
	status: String, reason: String, blocked_cell: Variant, run: Dictionary
) -> Dictionary:
	var position: Array = run["position"]
	return {
		"status": status,
		"reason": reason,
		"steps": (run["trace"] as Array).size(),
		"finalState": {"position": [position[0], position[1]], "direction": run["direction"]},
		"blockedCell": blocked_cell,
		"trace": run["trace"],
	}
