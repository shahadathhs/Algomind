class_name ProgramValidator
extends RefCounted
## Validates a program (the player's or a reference solution) against a level's limits.
## Mirrors checkProgram in packages/level-contract/src/validate.ts. LevelValidator calls it and
## owns the shared helpers; the issue format is the same.
##
## Slots: a primitive is 1; a loop is 1 plus the slots of its body items; an IF is 1 plus the
## primitives in its two branches.

## Where a node stands: at the top, as an item of a loop body, or inside an IF branch.
enum Place { TOP, BODY, BRANCH }


## Best-effort read of availableCommands and maxCommands from a level that may have other
## problems. "available" and "max" are null when unreadable.
static func limits_of(level: Variant) -> Dictionary:
	var limits := {"available": null, "max": null}
	if typeof(level) != TYPE_DICTIONARY:
		return limits
	var root: Dictionary = level
	if typeof(root.get("availableCommands")) == TYPE_ARRAY:
		var available: Array[String] = []
		for item: Variant in root["availableCommands"]:
			if LevelValidator._is_command_name(item):
				available.append(item)
		limits["available"] = available
	var constraints: Variant = root.get("constraints")
	if (
		typeof(constraints) == TYPE_DICTIONARY
		and LevelValidator._is_int(constraints.get("maxCommands"))
	):
		limits["max"] = int(constraints["maxCommands"])
	return limits


static func check_program(
	issues: Array[Dictionary], program: Variant, base: String, limits: Dictionary
) -> void:
	if typeof(program) != TYPE_ARRAY:
		LevelValidator._add(
			issues, base, "INVALID_TYPE", "%s must be an array of instructions." % base
		)
		return
	var nodes: Array = program
	var available: Variant = limits["available"]
	var slots := 0
	for i in nodes.size():
		var path := "%s[%d]" % [base, i]
		var node: Variant = nodes[i]
		slots += 1
		if typeof(node) != TYPE_DICTIONARY:
			LevelValidator._add(
				issues, path, "INVALID_TYPE", "%s must be an instruction object." % path
			)
			continue
		var node_dict: Dictionary = node
		LevelValidator._reject_unknown(issues, node_dict, path, _allowed_keys(node_dict.get("op")))
		var op: Variant = _check_op(issues, node_dict, path, available, Place.TOP)
		if ContractLimits.is_loop(op):
			slots += _check_loop(issues, node_dict, path, available, op)
		elif ContractLimits.is_if(op):
			slots += _check_if(issues, node_dict, path, available)
	var max_commands: Variant = limits["max"]
	if max_commands != null and slots > int(max_commands):
		LevelValidator._add(
			issues,
			base,
			"TOO_MANY_COMMANDS",
			"%s uses %d slots; this level allows %d." % [base, slots, max_commands]
		)


static func _allowed_keys(op: Variant) -> Array[String]:
	if ContractLimits.is_repeat(op):
		return ["op", "count", "body"]
	if ContractLimits.is_repeat_until(op):
		return ["op", "until", "body"]
	if ContractLimits.is_if(op):
		return ["op", "when", "then", "else"]
	return ["op"]


## Checks the op of one instruction. Returns the op when it is a known command, else null.
static func _check_op(
	issues: Array[Dictionary], node: Dictionary, path: String, available: Variant, place: Place
) -> Variant:
	var op_path := path + ".op"
	if not node.has("op"):
		LevelValidator._add(issues, op_path, "REQUIRED", "%s is required." % op_path)
		return null
	var op: Variant = node["op"]
	if typeof(op) != TYPE_STRING:
		LevelValidator._add(issues, op_path, "INVALID_TYPE", "%s must be a string." % op_path)
		return null
	if not LevelValidator._is_command_name(op):
		LevelValidator._add(
			issues, op_path, "UNKNOWN_COMMAND", "%s is not a known command." % op_path
		)
		return null
	if place != Place.TOP and ContractLimits.is_loop(op):
		LevelValidator._add(
			issues, op_path, "NESTED_REPEAT", "%s: a loop cannot contain a loop." % op_path
		)
		return null
	if place == Place.BRANCH and ContractLimits.is_if(op):
		LevelValidator._add(
			issues, op_path, "NESTED_IF", "%s: an IF cannot contain an IF." % op_path
		)
		return null
	if available != null and not (available as Array).has(op):
		LevelValidator._add(
			issues, op_path, "COMMAND_NOT_AVAILABLE", "%s is not available in this level." % op
		)
	return op


## Reads an array field with a length range. Returns the array, or null when absent or not an array.
static func _check_list(
	issues: Array[Dictionary],
	node: Dictionary,
	key: String,
	path: String,
	low: int,
	high: int,
	required: bool
) -> Variant:
	var list_path := "%s.%s" % [path, key]
	if not node.has(key):
		if required:
			LevelValidator._add(issues, list_path, "REQUIRED", "%s is required." % list_path)
		return null
	if typeof(node[key]) != TYPE_ARRAY:
		LevelValidator._add(
			issues, list_path, "INVALID_TYPE", "%s must be an array of instructions." % list_path
		)
		return null
	var list: Array = node[key]
	if list.size() < low or list.size() > high:
		LevelValidator._add(
			issues,
			list_path,
			"LENGTH_OUT_OF_RANGE",
			"%s must have %d to %d instructions." % [list_path, low, high]
		)
	return list


## Checks the sensor and both branches of an IF whose op was already checked. Returns the
## primitives in the branches (for slots).
static func _check_if(
	issues: Array[Dictionary], node: Dictionary, path: String, available: Variant
) -> int:
	var when_path := path + ".when"
	if not node.has("when"):
		LevelValidator._add(issues, when_path, "REQUIRED", "%s is required." % when_path)
	elif typeof(node["when"]) != TYPE_STRING:
		LevelValidator._add(issues, when_path, "INVALID_TYPE", "%s must be a string." % when_path)
	elif not ContractLimits.SENSORS.has(node["when"]):
		LevelValidator._add(
			issues,
			when_path,
			"INVALID_VALUE",
			"%s must be one of %s." % [when_path, ", ".join(ContractLimits.SENSORS)]
		)
	var slots := 0
	for key: String in ["then", "else"]:
		var low: int = ContractLimits.IF_THEN_MIN if key == "then" else ContractLimits.IF_ELSE_MIN
		var high: int = ContractLimits.IF_THEN_MAX if key == "then" else ContractLimits.IF_ELSE_MAX
		var list: Variant = _check_list(issues, node, key, path, low, high, true)
		if list == null:
			continue
		var items: Array = list
		slots += items.size()
		for j in items.size():
			var inner_path := "%s.%s[%d]" % [path, key, j]
			var inner: Variant = items[j]
			if typeof(inner) != TYPE_DICTIONARY:
				LevelValidator._add(
					issues,
					inner_path,
					"INVALID_TYPE",
					"%s must be an instruction object." % inner_path
				)
				continue
			var inner_dict: Dictionary = inner
			# A nested loop or IF is reported once, not field by field.
			var inner_op: Variant = inner_dict.get("op")
			if not (ContractLimits.is_loop(inner_op) or ContractLimits.is_if(inner_op)):
				LevelValidator._reject_unknown(issues, inner_dict, inner_path, ["op"])
			_check_op(issues, inner_dict, inner_path, available, Place.BRANCH)
	return slots


## Checks the until condition of a REPEAT_UNTIL.
static func _check_until(issues: Array[Dictionary], node: Dictionary, path: String) -> void:
	var until_path := path + ".until"
	if not node.has("until"):
		LevelValidator._add(issues, until_path, "REQUIRED", "%s is required." % until_path)
	elif typeof(node["until"]) != TYPE_STRING:
		LevelValidator._add(issues, until_path, "INVALID_TYPE", "%s must be a string." % until_path)
	elif not ContractLimits.UNTIL_CONDITIONS.has(node["until"]):
		LevelValidator._add(
			issues,
			until_path,
			"INVALID_VALUE",
			"%s must be one of %s." % [until_path, ", ".join(ContractLimits.UNTIL_CONDITIONS)]
		)


static func _check_count(issues: Array[Dictionary], node: Dictionary, path: String) -> void:
	var count_path := path + ".count"
	if not node.has("count"):
		LevelValidator._add(issues, count_path, "REQUIRED", "%s is required." % count_path)
	elif not LevelValidator._is_int(node["count"]):
		LevelValidator._add(
			issues, count_path, "INVALID_TYPE", "%s must be an integer." % count_path
		)
	else:
		var count := int(node["count"])
		if count < ContractLimits.REPEAT_COUNT_MIN or count > ContractLimits.REPEAT_COUNT_MAX:
			LevelValidator._add(
				issues,
				count_path,
				"OUT_OF_RANGE",
				(
					"%s must be from %d to %d."
					% [count_path, ContractLimits.REPEAT_COUNT_MIN, ContractLimits.REPEAT_COUNT_MAX]
				)
			)


## Checks the count (REPEAT) or condition (REPEAT_UNTIL) and the body of a loop. Returns the
## slots of the body items.
static func _check_loop(
	issues: Array[Dictionary], node: Dictionary, path: String, available: Variant, op: Variant
) -> int:
	if ContractLimits.is_repeat_until(op):
		_check_until(issues, node, path)
	else:
		_check_count(issues, node, path)
	var body: Variant = _check_list(
		issues,
		node,
		"body",
		path,
		ContractLimits.REPEAT_BODY_MIN,
		ContractLimits.REPEAT_BODY_MAX,
		true
	)
	if body == null:
		return 0
	var items: Array = body
	var slots := 0
	for j in items.size():
		var inner_path := "%s.body[%d]" % [path, j]
		var inner: Variant = items[j]
		slots += 1
		if typeof(inner) != TYPE_DICTIONARY:
			LevelValidator._add(
				issues, inner_path, "INVALID_TYPE", "%s must be an instruction object." % inner_path
			)
			continue
		var inner_dict: Dictionary = inner
		var inner_op: Variant = inner_dict.get("op")
		# A nested loop is reported once, as NESTED_REPEAT, not field by field.
		if not ContractLimits.is_loop(inner_op):
			LevelValidator._reject_unknown(issues, inner_dict, inner_path, _allowed_keys(inner_op))
		var known: Variant = _check_op(issues, inner_dict, inner_path, available, Place.BODY)
		if ContractLimits.is_if(known):
			slots += _check_if(issues, inner_dict, inner_path, available)
	return slots
