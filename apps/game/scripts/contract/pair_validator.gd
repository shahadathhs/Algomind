class_name PairValidator
extends RefCounted
## Validates the optional paired cells of a level: keys and doors (`locks`) and items and docks
## (`deliveries`). Mirrors validatePairs in packages/level-contract/src/validate.ts. Issues use
## LevelValidator's helpers and shape.

const LOCKS := {
	"field": "locks",
	"parts": ["key", "door"],
	"noun": "keys and doors",
	"min": ContractLimits.LOCKS_MIN,
	"max": ContractLimits.LOCKS_MAX,
	"apart": "",
	"wall": "LOCK_ON_WALL",
	"start": "LOCK_ON_START",
	"goal": "LOCK_ON_GOAL",
	"repeat": "LOCK_CELLS_REPEAT",
	"boards": "LOCKS_WITH_BOARDS",
	"sweep": "LOCKS_WITH_SWEEP",
}

const DELIVERIES := {
	"field": "deliveries",
	"parts": ["item", "dock"],
	"noun": "deliveries",
	"min": ContractLimits.DELIVERIES_MIN,
	"max": ContractLimits.DELIVERIES_MAX,
	"apart": "locks",
	"wall": "DELIVERY_ON_WALL",
	"start": "DELIVERY_ON_START",
	"goal": "DELIVERY_ON_GOAL",
	"repeat": "DELIVERY_CELLS_REPEAT",
	"boards": "DELIVERIES_WITH_BOARDS",
	"sweep": "DELIVERIES_WITH_SWEEP",
}


static func check_all(issues: Array[Dictionary], root: Dictionary) -> void:
	check_pairs(issues, root, LOCKS)
	check_pairs(issues, root, DELIVERIES)


static func check_pairs(issues: Array[Dictionary], root: Dictionary, spec: Dictionary) -> void:
	var field: String = spec["field"]
	if not root.has(field):
		return
	var raw: Variant = root[field]
	if typeof(raw) != TYPE_ARRAY:
		LevelValidator._add(issues, field, "INVALID_TYPE", "%s must be an array." % field)
		return
	var entries: Array = raw
	if entries.size() < int(spec["min"]) or entries.size() > int(spec["max"]):
		LevelValidator._add(
			issues,
			field,
			"LENGTH_OUT_OF_RANGE",
			(
				"%s must have %d to %d entries, or be left out."
				% [field, int(spec["min"]), int(spec["max"])]
			)
		)
	if root.has("extraBoards"):
		LevelValidator._add(
			issues, field, spec["boards"], "A level with test boards cannot have %s." % spec["noun"]
		)
	var goal: Variant = root.get("goal")
	if typeof(goal) == TYPE_DICTIONARY and (goal as Dictionary).get("type") == "visit_all":
		LevelValidator._add(
			issues,
			field,
			spec["sweep"],
			"A level that sweeps every cell cannot have %s." % spec["noun"]
		)
	var facts := PatrolValidator.board_facts(root)
	var seen: Array[Vector2i] = []
	if spec["apart"] == "locks":
		seen = _cells_of(root, "locks")
	for i in entries.size():
		_check_entry(issues, entries[i], "%s[%d]" % [field, i], spec, facts, seen)


## The key and door cells of `locks`, read leniently (an entry that is not a pair is skipped).
static func _cells_of(root: Dictionary, field: String) -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	if typeof(root.get(field)) != TYPE_ARRAY:
		return cells
	for entry: Variant in root[field]:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		for part: String in ["key", "door"]:
			var cell: Variant = (entry as Dictionary).get(part)
			if typeof(cell) == TYPE_ARRAY and (cell as Array).size() == 2:
				var x: Variant = cell[0]
				var y: Variant = cell[1]
				if LevelValidator._is_int(x) and LevelValidator._is_int(y):
					cells.append(Vector2i(int(x), int(y)))
	return cells


static func _check_entry(
	issues: Array[Dictionary],
	entry: Variant,
	path: String,
	spec: Dictionary,
	facts: Dictionary,
	seen: Array[Vector2i]
) -> void:
	if typeof(entry) != TYPE_DICTIONARY:
		LevelValidator._add(issues, path, "INVALID_TYPE", "%s must be an object." % path)
		return
	var pair_entry: Dictionary = entry
	var parts: Array[String] = []
	parts.assign(spec["parts"])
	LevelValidator._reject_unknown(issues, pair_entry, path, parts)
	for part: String in parts:
		var cell_path := "%s.%s" % [path, part]
		if not pair_entry.has(part):
			LevelValidator._add(issues, cell_path, "REQUIRED", "%s is required." % cell_path)
			continue
		var pair: Variant = LevelValidator._check_pair(
			issues, pair_entry[part], cell_path, facts["size"]
		)
		if pair == null:
			continue
		var at: Vector2i = pair
		if (facts["walls"] as Array).has(at):
			LevelValidator._add(
				issues, cell_path, spec["wall"], "%s must not be a wall." % cell_path
			)
		if facts["start"] != null and facts["start"] == at:
			LevelValidator._add(
				issues, cell_path, spec["start"], "%s must not be the automaton's cell." % cell_path
			)
		if facts["goal"] != null and facts["goal"] == at:
			LevelValidator._add(
				issues, cell_path, spec["goal"], "%s must not be the target." % cell_path
			)
		if seen.has(at):
			LevelValidator._add(
				issues,
				cell_path,
				spec["repeat"],
				"%s repeats an earlier cell of %s." % [cell_path, spec["noun"]]
			)
		else:
			seen.append(at)
