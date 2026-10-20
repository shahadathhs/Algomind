class_name ProgramShape
extends RefCounted
## Which program nodes the simulator can run. A node that fails these checks stops the run with
## INVALID_INSTRUCTION. Mirrors the runnable function of level-contract src/simulate.ts.

## Where a node stands, which decides what it may hold.
enum Place { TOP, LOOP_BODY, PROC_BODY, PROC_LOOP_BODY }


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


## True for a list of runnable items whose length is within [low, high].
static func _is_runnable_list(
	list: Variant, low: int, high: int, place: Place, procs: Dictionary
) -> bool:
	if typeof(list) != TYPE_ARRAY:
		return false
	var items: Array = list
	if items.size() < low or items.size() > high:
		return false
	for item: Variant in items:
		if not is_runnable(item, place, procs):
			return false
	return true


## True when the node and everything inside it can be run: known ops and conditions, bodies and
## branches of the right size, and only what the place allows. procs maps the names a CALL may use.
static func is_runnable(node: Variant, place: Place, procs: Dictionary) -> bool:
	if typeof(node) != TYPE_DICTIONARY:
		return false
	if is_primitive(node):
		return true
	var op: Variant = node.get("op")
	if ContractLimits.is_if(op):
		return is_runnable_if(node)
	if ContractLimits.is_call(op):
		var name: Variant = node.get("name")
		return (
			(place == Place.TOP or place == Place.LOOP_BODY)
			and typeof(name) == TYPE_STRING
			and procs.has(name)
		)
	if ContractLimits.is_loop(op):
		if place == Place.LOOP_BODY or place == Place.PROC_LOOP_BODY:
			return false
		var inner := Place.PROC_LOOP_BODY if place == Place.PROC_BODY else Place.LOOP_BODY
		if ContractLimits.is_repeat(op):
			if not _is_valid_count(node.get("count")):
				return false
		else:
			var until: Variant = node.get("until")
			if typeof(until) != TYPE_STRING or not ContractLimits.UNTIL_CONDITIONS.has(until):
				return false
		return _is_runnable_list(
			node.get("body"),
			ContractLimits.REPEAT_BODY_MIN,
			ContractLimits.REPEAT_BODY_MAX,
			inner,
			procs
		)
	if ContractLimits.is_proc(op):
		var proc_name: Variant = node.get("name")
		return (
			place == Place.TOP
			and typeof(proc_name) == TYPE_STRING
			and ContractLimits.PROCEDURE_NAMES.has(proc_name)
			and _is_runnable_list(
				node.get("body"),
				ContractLimits.PROC_BODY_MIN,
				ContractLimits.PROC_BODY_MAX,
				Place.PROC_BODY,
				procs
			)
		)
	return false


static func _is_valid_count(count: Variant) -> bool:
	if typeof(count) == TYPE_FLOAT:
		if count != floorf(count):
			return false
	elif typeof(count) != TYPE_INT:
		return false
	return (
		int(count) >= ContractLimits.REPEAT_COUNT_MIN
		and int(count) <= ContractLimits.REPEAT_COUNT_MAX
	)


## The procedures a CALL can reach: name -> { "node": the PROC node, "index": its index }. The
## first well-formed definition of each name wins.
static func reachable_procs(program: Array) -> Dictionary:
	var procs := {}
	for i in program.size():
		var node: Variant = program[i]
		if typeof(node) != TYPE_DICTIONARY or not ContractLimits.is_proc(node.get("op")):
			continue
		var name: Variant = node.get("name")
		if typeof(name) != TYPE_STRING or procs.has(name):
			continue
		if is_runnable(node, Place.TOP, {}):
			procs[name] = {"node": node, "index": i}
	return procs
