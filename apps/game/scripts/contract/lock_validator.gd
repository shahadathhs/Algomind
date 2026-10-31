class_name LockValidator
extends RefCounted
## Validates the optional keys and doors (`locks`) of a level.
## Mirrors validateLocks in packages/level-contract/src/validate.ts. Issues use LevelValidator's
## helpers and shape.


static func check_locks(issues: Array[Dictionary], root: Dictionary) -> void:
	if not root.has("locks"):
		return
	var raw: Variant = root["locks"]
	if typeof(raw) != TYPE_ARRAY:
		LevelValidator._add(issues, "locks", "INVALID_TYPE", "locks must be an array.")
		return
	var entries: Array = raw
	if entries.size() < ContractLimits.LOCKS_MIN or entries.size() > ContractLimits.LOCKS_MAX:
		LevelValidator._add(
			issues,
			"locks",
			"LENGTH_OUT_OF_RANGE",
			(
				"locks must have %d to %d entries, or be left out."
				% [ContractLimits.LOCKS_MIN, ContractLimits.LOCKS_MAX]
			)
		)
	if root.has("extraBoards"):
		LevelValidator._add(
			issues,
			"locks",
			"LOCKS_WITH_BOARDS",
			"A level with test boards cannot have keys and doors."
		)
	var goal: Variant = root.get("goal")
	if typeof(goal) == TYPE_DICTIONARY and (goal as Dictionary).get("type") == "visit_all":
		LevelValidator._add(
			issues,
			"locks",
			"LOCKS_WITH_SWEEP",
			"A level that sweeps every cell cannot have keys and doors."
		)
	var facts := PatrolValidator.board_facts(root)
	var seen: Array[Vector2i] = []
	for i in entries.size():
		_check_lock(issues, entries[i], "locks[%d]" % i, facts, seen)


static func _check_lock(
	issues: Array[Dictionary],
	entry: Variant,
	path: String,
	facts: Dictionary,
	seen: Array[Vector2i]
) -> void:
	if typeof(entry) != TYPE_DICTIONARY:
		LevelValidator._add(issues, path, "INVALID_TYPE", "%s must be an object." % path)
		return
	var lock: Dictionary = entry
	LevelValidator._reject_unknown(issues, lock, path, ["key", "door"])
	for part in ["key", "door"]:
		var cell_path := "%s.%s" % [path, part]
		if not lock.has(part):
			LevelValidator._add(issues, cell_path, "REQUIRED", "%s is required." % cell_path)
			continue
		var pair: Variant = LevelValidator._check_pair(issues, lock[part], cell_path, facts["size"])
		if pair == null:
			continue
		var at: Vector2i = pair
		if (facts["walls"] as Array).has(at):
			LevelValidator._add(
				issues, cell_path, "LOCK_ON_WALL", "%s must not be a wall." % cell_path
			)
		if facts["start"] != null and facts["start"] == at:
			LevelValidator._add(
				issues,
				cell_path,
				"LOCK_ON_START",
				"%s must not be the automaton's cell." % cell_path
			)
		if facts["goal"] != null and facts["goal"] == at:
			LevelValidator._add(
				issues, cell_path, "LOCK_ON_GOAL", "%s must not be the target." % cell_path
			)
		if seen.has(at):
			LevelValidator._add(
				issues,
				cell_path,
				"LOCK_CELLS_REPEAT",
				"%s repeats an earlier key or door." % cell_path
			)
		else:
			seen.append(at)
