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


## Runs program (an Array of instruction nodes) on level (parsed JSON Dictionary).
## Returns { status, reason, steps, finalState, blockedCell, trace }.
static func simulate(level: Dictionary, program: Array) -> Dictionary:
	var board: Dictionary = level["board"]
	var width := int(board["width"])
	var height := int(board["height"])
	var walls := {}
	for wall: Array in board["walls"]:
		walls[Vector2i(int(wall[0]), int(wall[1]))] = true

	var initial: Dictionary = level["initialState"]
	var start: Array = initial["position"]
	var position: Array = [int(start[0]), int(start[1])]
	var direction: String = initial["direction"]
	var goal_cell: Array = level["goal"]["position"]
	var goal := Vector2i(int(goal_cell[0]), int(goal_cell[1]))
	var max_steps := int(level["constraints"]["maxSteps"])
	var trace: Array = []

	for node: Variant in program:
		if trace.size() >= max_steps:
			return _finish("FAILED", "STEP_LIMIT", null, position, direction, trace)

		var op: Variant = null
		if typeof(node) == TYPE_DICTIONARY:
			op = node.get("op")
		if typeof(op) != TYPE_STRING or not ContractLimits.COMMAND_NAMES.has(op):
			return _finish("FAILED", "INVALID_INSTRUCTION", null, position, direction, trace)

		var command: String = op
		if command == _LEFT or command == _RIGHT:
			direction = turn(direction, "left" if command == _LEFT else "right")
			trace.append(_entry(trace.size(), command, position, direction, "TURNED"))
			continue

		# MOVE_FORWARD
		var target := cell_ahead(position, direction)
		var tx := int(target[0])
		var ty := int(target[1])
		if tx < 0 or ty < 0 or tx >= width or ty >= height:
			trace.append(_entry(trace.size(), command, position, direction, "BLOCKED_BY_BOUNDARY"))
			return _finish("FAILED", "BLOCKED_BY_BOUNDARY", target, position, direction, trace)
		if walls.has(Vector2i(tx, ty)):
			trace.append(_entry(trace.size(), command, position, direction, "BLOCKED_BY_WALL"))
			return _finish("FAILED", "BLOCKED_BY_WALL", target, position, direction, trace)

		position = target
		if Vector2i(tx, ty) == goal:
			trace.append(_entry(trace.size(), command, position, direction, "GOAL_REACHED"))
			return _finish("SUCCEEDED", "GOAL_REACHED", null, position, direction, trace)
		trace.append(_entry(trace.size(), command, position, direction, "MOVED"))

	return _finish("FAILED", "PROGRAM_ENDED", null, position, direction, trace)


static func _entry(
	index: int, op: String, position: Array, direction: String, event: String
) -> Dictionary:
	return {
		"index": index,
		"op": op,
		"position": [position[0], position[1]],
		"direction": direction,
		"event": event,
	}


static func _finish(
	status: String,
	reason: String,
	blocked_cell: Variant,
	position: Array,
	direction: String,
	trace: Array
) -> Dictionary:
	return {
		"status": status,
		"reason": reason,
		"steps": trace.size(),
		"finalState": {"position": [position[0], position[1]], "direction": direction},
		"blockedCell": blocked_cell,
		"trace": trace,
	}
