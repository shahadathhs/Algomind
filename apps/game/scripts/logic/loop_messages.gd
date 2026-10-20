class_name LoopMessages
extends RefCounted
## Plain-language failure text that depends on which loop was running. ResultMessages holds the
## text for each reason code; this adds the cases a code alone cannot tell apart.


## The text for a finished run that involved a REPEAT_UNTIL, or "" when the standard text for the
## result's reason applies. `program` is the program that was run.
static func for_result(level: Dictionary, program: Array, result: Dictionary) -> String:
	if result.get("status") != "FAILED" or result.get("reason") != "STEP_LIMIT":
		return ""
	if _stopped_in_until_loop(level, program, result):
		return "The loop never reached a wall, so it was stopped."
	return ""


## True when the step limit cut off a REPEAT_UNTIL that was still waiting for its condition: the
## last step ran in its body and the way ahead was still open.
static func _stopped_in_until_loop(level: Dictionary, program: Array, result: Dictionary) -> bool:
	var trace: Array = result.get("trace", [])
	if trace.is_empty():
		return false
	var node: Array = trace[trace.size() - 1]["node"]
	if node.size() != 2:
		return false
	var index := int(node[0])
	if index >= program.size() or not ContractLimits.is_repeat_until(program[index].get("op")):
		return false
	var state: Dictionary = result["finalState"]
	return not LevelSimulator.blocked_ahead(level, state["position"], String(state["direction"]))
