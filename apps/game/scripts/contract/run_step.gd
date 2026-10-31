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
		return _stayed(run, command, node, round_number, call_path, "TURNED")

	if command == ContractLimits.INC_OP:
		run["counter"] = mini(int(run["counter"]) + 1, ContractLimits.COUNTER_MAX)
		return _stayed(run, command, node, round_number, call_path, "COUNTED")
	if command == ContractLimits.MARK_OP:
		var here := Vector2i(int(position[0]), int(position[1]))
		var crumbs: Dictionary = run["crumbs"]
		if not crumbs.has(here):
			crumbs[here] = (ContractLimits.DIRECTIONS.find(direction) + 2) % 4
		return _stayed(run, command, node, round_number, call_path, "MARKED")
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
	var hit: Variant = _caught(run, position, command, node, round_number, call_path)
	if hit != null:
		return hit
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


## Ends an action that does not move the automaton: caught by a patrol, or done with `event`.
static func _stayed(
	run: Dictionary,
	command: String,
	node: Array,
	round_number: Variant,
	call_path: Variant,
	event: String
) -> Variant:
	var hit: Variant = _caught(run, run["position"], command, node, round_number, call_path)
	if hit != null:
		return hit
	var trace: Array = run["trace"]
	trace.append(
		entry(
			run,
			trace.size(),
			command,
			node,
			call_path,
			round_number,
			run["position"],
			run["direction"],
			event
		)
	)
	return null


## A patrol that reaches the automaton in this step ends the run (checked before the goal).
## `from` is where the automaton stood before the action.
static func _caught(
	run: Dictionary,
	from: Array,
	command: String,
	node: Array,
	round_number: Variant,
	call_path: Variant
) -> Variant:
	var trace: Array = run["trace"]
	var found: Variant = Patrol.meeting(run["patrols"], from, run["position"], trace.size())
	if found == null:
		return null
	trace.append(
		entry(
			run,
			trace.size(),
			command,
			node,
			call_path,
			round_number,
			run["position"],
			run["direction"],
			"HIT_BY_PATROL"
		)
	)
	return finish("FAILED", "HIT_BY_PATROL", found, run)


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
