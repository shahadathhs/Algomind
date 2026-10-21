class_name RunStep
extends RefCounted
## Runs one action of a program for LevelSimulator and builds its trace entry and final result.
## Mirrors the step function of packages/level-contract/src/simulate.ts.

const LEFT := "TURN_LEFT"
const RIGHT := "TURN_RIGHT"


## Runs one primitive. Returns the final result Dictionary when the run ends here, else null.
static func step(
	run: Dictionary, command: String, node: Array, round_number: Variant, call_path: Variant
) -> Variant:
	var trace: Array = run["trace"]
	if trace.size() >= int(run["max_steps"]):
		return finish("FAILED", "STEP_LIMIT", null, run)
	var position: Array = run["position"]
	var direction: String = run["direction"]
	var index := trace.size()
	if command == LEFT or command == RIGHT:
		run["direction"] = LevelSimulator.turn(direction, "left" if command == LEFT else "right")
		trace.append(
			entry(
				run,
				index,
				command,
				node,
				call_path,
				round_number,
				position,
				run["direction"],
				"TURNED"
			)
		)
		return null

	if command == ContractLimits.INC_OP:
		run["counter"] = mini(int(run["counter"]) + 1, ContractLimits.COUNTER_MAX)
		trace.append(
			entry(
				run, index, command, node, call_path, round_number, position, direction, "COUNTED"
			)
		)
		return null
	if command == ContractLimits.MARK_OP:
		var here := Vector2i(int(position[0]), int(position[1]))
		var crumbs: Dictionary = run["crumbs"]
		if not crumbs.has(here):
			crumbs[here] = (ContractLimits.DIRECTIONS.find(direction) + 2) % 4
		trace.append(
			entry(run, index, command, node, call_path, round_number, position, direction, "MARKED")
		)
		return null
	return move(run, command, node, round_number, call_path)


## Runs MOVE_FORWARD. Returns the final result when the run ends here, else null.
static func move(
	run: Dictionary, command: String, node: Array, round_number: Variant, call_path: Variant
) -> Variant:
	var trace: Array = run["trace"]
	var position: Array = run["position"]
	var direction: String = run["direction"]
	var index := trace.size()
	var target := LevelSimulator.cell_ahead(position, direction)
	var tx := int(target[0])
	var ty := int(target[1])
	var blocked := ""
	if tx < 0 or ty < 0 or tx >= int(run["width"]) or ty >= int(run["height"]):
		blocked = "BLOCKED_BY_BOUNDARY"
	elif (run["walls"] as Dictionary).has(Vector2i(tx, ty)):
		blocked = "BLOCKED_BY_WALL"
	if blocked != "":
		trace.append(
			entry(run, index, command, node, call_path, round_number, position, direction, blocked)
		)
		return finish("FAILED", blocked, target, run)

	run["position"] = target
	var cell := Vector2i(tx, ty)
	(run["visited"] as Dictionary)[cell] = true
	var reached: bool
	if run["goal"] == null:
		reached = (run["visited"] as Dictionary).size() == int(run["floor_cells"])
	else:
		reached = cell == run["goal"]
	if reached:
		trace.append(
			entry(
				run,
				index,
				command,
				node,
				call_path,
				round_number,
				target,
				direction,
				"GOAL_REACHED"
			)
		)
		return finish("SUCCEEDED", "GOAL_REACHED", null, run)
	trace.append(
		entry(run, index, command, node, call_path, round_number, target, direction, "MOVED")
	)
	return null


static func entry(
	run: Dictionary,
	index: int,
	op: String,
	node: Array,
	call_path: Variant,
	round_number: Variant,
	position: Array,
	direction: String,
	event: String
) -> Dictionary:
	return {
		"index": index,
		"op": op,
		"node": node,
		"call": call_path,
		"counter": run["counter"],
		"round": round_number,
		"position": [position[0], position[1]],
		"direction": direction,
		"event": event,
	}


static func finish(
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
