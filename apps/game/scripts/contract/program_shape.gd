class_name ProgramShape
extends RefCounted
## Which program nodes the simulator can run. A node that fails these checks stops the run with
## INVALID_INSTRUCTION. Mirrors the isRunnable functions of level-contract src/simulate.ts.


## True for one primitive node: an object whose op is MOVE_FORWARD, TURN_LEFT, or TURN_RIGHT.
static func is_primitive(node: Variant) -> bool:
	return (
		typeof(node) == TYPE_DICTIONARY
		and typeof(node.get("op")) == TYPE_STRING
		and ContractLimits.PRIMITIVE_COMMANDS.has(node["op"])
	)


## True for a list of primitives whose length is within [low, high].
static func _is_primitive_list(list: Variant, low: int, high: int) -> bool:
	if typeof(list) != TYPE_ARRAY:
		return false
	var items: Array = list
	if items.size() < low or items.size() > high:
		return false
	for item: Variant in items:
		if not is_primitive(item):
			return false
	return true


## True for an IF the simulator can run: a known sensor, 1 to 4 primitives to run and 0 to 4 else.
static func is_runnable_if(node: Variant) -> bool:
	if typeof(node) != TYPE_DICTIONARY or not ContractLimits.is_if(node.get("op")):
		return false
	var when: Variant = node.get("when")
	return (
		typeof(when) == TYPE_STRING
		and ContractLimits.SENSORS.has(when)
		and _is_primitive_list(
			node.get("then"), ContractLimits.IF_THEN_MIN, ContractLimits.IF_THEN_MAX
		)
		and _is_primitive_list(
			node.get("else"), ContractLimits.IF_ELSE_MIN, ContractLimits.IF_ELSE_MAX
		)
	)


## True for a body the simulator can run: 1 to 8 items, each a primitive or a runnable IF.
static func is_runnable_body(body: Variant) -> bool:
	if typeof(body) != TYPE_ARRAY:
		return false
	var items: Array = body
	if (
		items.size() < ContractLimits.REPEAT_BODY_MIN
		or items.size() > ContractLimits.REPEAT_BODY_MAX
	):
		return false
	for item: Variant in items:
		if not (is_primitive(item) or is_runnable_if(item)):
			return false
	return true


## True for a loop the simulator can run: a whole count in range and a runnable body.
static func is_runnable_repeat(node: Variant) -> bool:
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
	return is_runnable_body(node.get("body"))


## True for a conditional loop the simulator can run: a known condition and a runnable body.
static func is_runnable_repeat_until(node: Variant) -> bool:
	if typeof(node) != TYPE_DICTIONARY or not ContractLimits.is_repeat_until(node.get("op")):
		return false
	var until: Variant = node.get("until")
	return (
		typeof(until) == TYPE_STRING
		and ContractLimits.UNTIL_CONDITIONS.has(until)
		and is_runnable_body(node.get("body"))
	)
