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


## True when the cell on a side of the automaton is on the board and not a wall. A sensor is
## CLEAR_AHEAD, CLEAR_LEFT, or CLEAR_RIGHT.
static func _is_clear(run: Dictionary, sensor: String) -> bool:
	var facing: String = run["direction"]
	if sensor == "CLEAR_LEFT":
		facing = turn(facing, "left")
	elif sensor == "CLEAR_RIGHT":
		facing = turn(facing, "right")
	var target := cell_ahead(run["position"], facing)
	var tx := int(target[0])
	var ty := int(target[1])
	if tx < 0 or ty < 0 or tx >= int(run["width"]) or ty >= int(run["height"]):
		return false
	return not (run["walls"] as Dictionary).has(Vector2i(tx, ty))


## True when a wall or the board edge is straight ahead of position facing direction.
static func blocked_ahead(level: Dictionary, position: Array, direction: String) -> bool:
	var board: Dictionary = level["board"]
	var target := cell_ahead(position, direction)
	var tx := int(target[0])
	var ty := int(target[1])
	if tx < 0 or ty < 0 or tx >= int(board["width"]) or ty >= int(board["height"]):
		return true
	for wall: Array in board["walls"]:
		if int(wall[0]) == tx and int(wall[1]) == ty:
			return true
	return false


## Runs one body item (a primitive or an IF) at path as round_number. Returns the final result or
## null. An IF reads its sensor now, then runs the chosen branch; the step limit is checked before
## each of its primitives.
static func _run_item(
	run: Dictionary, item: Dictionary, path: Array, round_number: Variant, max_steps: int
) -> Variant:
	if not ContractLimits.is_if(item["op"]):
		return _step(run, String(item["op"]), path, round_number)
	var taken_then := _is_clear(run, String(item["when"]))
	var branch: Array = item["then"] if taken_then else item["else"]
	var offset: int = 0 if taken_then else (item["then"] as Array).size()
	for k in branch.size():
		if (run["trace"] as Array).size() >= max_steps:
			return _finish("FAILED", "STEP_LIMIT", null, run)
		var inner_path := path.duplicate()
		inner_path.append(offset + k)
		var result: Variant = _step(run, String(branch[k]["op"]), inner_path, round_number)
		if result != null:
			return result
	return null


## Runs the body of node i once, as round_number. Returns the final result or null.
static func _run_body(
	run: Dictionary, body: Array, i: int, round_number: int, max_steps: int
) -> Variant:
	for j in body.size():
		var item: Dictionary = body[j]
		if not ContractLimits.is_if(item["op"]) and (run["trace"] as Array).size() >= max_steps:
			return _finish("FAILED", "STEP_LIMIT", null, run)
		var result: Variant = _run_item(run, item, [i, j], round_number, max_steps)
		if result != null:
			return result
	return null


## Runs program (an Array of instruction nodes) on level (parsed JSON Dictionary).
## Returns { status, reason, steps, finalState, blockedCell, trace }.
##
## Every executed primitive is one step; a REPEAT, REPEAT_UNTIL or IF itself costs none, and
## choosing an IF branch is free. A REPEAT_UNTIL checks its condition before every round (free),
## so it may run zero rounds; a round that runs no primitive stops the run with STEP_LIMIT. The
## step limit is checked before each node and before each primitive inside a loop. The run
## succeeds the moment the goal cell is entered, even in the middle of a loop.
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

		if ProgramShape.is_primitive(node) or ProgramShape.is_runnable_if(node):
			var result: Variant = _run_item(run, node, [i], null, max_steps)
			if result != null:
				return result
			continue
		if ProgramShape.is_runnable_repeat_until(node):
			# The condition is checked before every round; the check costs no step. GOAL is never
			# true at the start of a round. A round that ran no primitive would repeat for ever.
			var round_number := 1
			while not (node["until"] == "BLOCKED" and not _is_clear(run, "CLEAR_AHEAD")):
				var before := (run["trace"] as Array).size()
				var outcome: Variant = _run_body(run, node["body"], i, round_number, max_steps)
				if outcome != null:
					return outcome
				if (run["trace"] as Array).size() == before:
					return _finish("FAILED", "STEP_LIMIT", null, run)
				round_number += 1
			continue
		if not ProgramShape.is_runnable_repeat(node):
			return _finish("FAILED", "INVALID_INSTRUCTION", null, run)

		for round_number in range(1, int(node["count"]) + 1):
			var outcome: Variant = _run_body(run, node["body"], i, round_number, max_steps)
			if outcome != null:
				return outcome

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
