class_name LoopMessages
extends RefCounted
## Plain-language failure text that depends on which loop was running. ResultMessages holds the
## text for each reason code; this adds the cases a code alone cannot tell apart.


## The text for a finished run that involved a REPEAT_UNTIL, or "" when the standard text for the
## result's reason applies. `program` is the program that was run.
static func for_result(level: Dictionary, program: Array, result: Dictionary) -> String:
	if result.get("status") != "FAILED" or result.get("reason") != "STEP_LIMIT":
		return ""
	var trace: Array = result.get("trace", [])
	if int(result.get("steps", 0)) < int(level["constraints"]["maxSteps"]):
		# Stopped below the step limit: a round of a REPEAT_UNTIL ran no command at all.
		return "A round of the loop did nothing, so it was stopped."
	if trace.is_empty():
		return ""
	var loop := _until_loop_of(program, trace[trace.size() - 1]["node"])
	if loop.is_empty():
		return ""
	if loop["until"] == "GOAL":
		return "The loop never reached the goal, so it was stopped."
	if _blocked_ahead(level, result):
		return ""
	return "The loop never reached a wall, so it was stopped."


## The REPEAT_UNTIL that the step at `node` ran in, or an empty Dictionary.
static func _until_loop_of(program: Array, node: Array) -> Dictionary:
	var index := int(node[0])
	if node.size() < 2 or index >= program.size():
		return {}
	var loop: Dictionary = program[index]
	return loop if ContractLimits.is_repeat_until(loop.get("op")) else {}


## True when the way ahead of the automaton is blocked at the end of the run.
static func _blocked_ahead(level: Dictionary, result: Dictionary) -> bool:
	var state: Dictionary = result["finalState"]
	return LevelSimulator.blocked_ahead(level, state["position"], String(state["direction"]))


## The objective text while the program is being built: what is missing, else the goal.
static func building_text(tape: TapeModel) -> String:
	if TapeCells.has_empty_loop(tape.nodes):
		return "ADD A COMMAND TO THE LOOP"
	if TapeCells.has_empty_if(tape.nodes):
		return "ADD A COMMAND TO THE IF"
	if tape.has_empty_proc():
		return "ADD A COMMAND TO THE PROCEDURE"
	var missing := tape.undefined_calls()
	if not missing.is_empty():
		return "PROCEDURE %s IS NOT DEFINED" % " AND ".join(missing)
	return "REACH THE TARGET"
