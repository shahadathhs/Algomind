class_name Campaign
extends RefCounted
## The campaign: worlds, then chapters, then levels, built from data.
##
## Placement (world, chapter, order) lives in data/campaign.json and refers to levels by slug,
## the stable id of a level (progress is keyed by it, online and offline).
## Level content lives in one file per level and is checked by LevelValidator before it is used.
## An invalid or missing level is left out and reported in `errors`; loading never crashes.
## The flattened order (world, chapter, level) is the unlock order.

const BUNDLED_CAMPAIGN := "res://data/campaign.json"
const BUNDLED_LEVELS := "res://data/levels"
## The mechanics this version of the game can play (the client-registry names).
const SUPPORTED_MECHANICS: Array[String] = ["move", "turn"]

## [{ id, title, summary, chapters: [{ id, title, entries: [entry] }] }]
var worlds: Array[Dictionary] = []
## Every playable level in unlock order. An entry is
## { id, number, world, chapter, level }: number starts at 1, world and chapter are indexes
## into `worlds`, level is the validated level Dictionary.
var entries: Array[Dictionary] = []
## Human-readable reasons something was skipped. Empty when everything loaded.
var errors: Array[String] = []


static func load_bundled() -> Campaign:
	return from_files(BUNDLED_CAMPAIGN, BUNDLED_LEVELS)


## Reads the placement file and `<levels_dir>/<levelId>.json` for every level it names.
static func from_files(campaign_path: String, levels_dir: String) -> Campaign:
	var loader := func(level_id: String) -> Variant:
		return _read_json("%s/%s.json" % [levels_dir, level_id])
	return from_data(_read_json(campaign_path), loader)


## Builds the campaign from parsed placement data and a loader Callable(level_id) -> Variant
## that returns the parsed level JSON (or null when it cannot be read).
static func from_data(placement: Variant, loader: Callable) -> Campaign:
	var campaign := Campaign.new()
	if typeof(placement) != TYPE_DICTIONARY or typeof(placement.get("worlds")) != TYPE_ARRAY:
		campaign.errors.append("The campaign data is missing or malformed.")
		return campaign
	var seen := {}
	for raw_world: Variant in placement["worlds"]:
		campaign._add_world(raw_world, loader, seen)
	return campaign


func entry_by_id(level_id: String) -> Dictionary:
	for entry in entries:
		if entry["id"] == level_id:
			return entry
	return {}


## Index in the flattened order, or -1.
func index_of(level_id: String) -> int:
	for i in entries.size():
		if entries[i]["id"] == level_id:
			return i
	return -1


## The entry after this level in the flattened order, or an empty Dictionary at the end.
func next_after(level_id: String) -> Dictionary:
	var i := index_of(level_id)
	if i < 0 or i + 1 >= entries.size():
		return {}
	return entries[i + 1]


static func _read_json(path: String) -> Variant:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	return JSON.parse_string(file.get_as_text())


func _add_world(raw_world: Variant, loader: Callable, seen: Dictionary) -> void:
	if typeof(raw_world) != TYPE_DICTIONARY or typeof(raw_world.get("chapters")) != TYPE_ARRAY:
		errors.append("A world in the campaign data is malformed.")
		return
	var world := {
		"id": str(raw_world.get("id", "")),
		"title": str(raw_world.get("title", "")),
		"summary": str(raw_world.get("summary", "")),
		"chapters": [],
	}
	var world_index := worlds.size()
	for raw_chapter: Variant in raw_world["chapters"]:
		if (
			typeof(raw_chapter) != TYPE_DICTIONARY
			or typeof(raw_chapter.get("levels")) != TYPE_ARRAY
		):
			errors.append("A chapter in world %s is malformed." % world["id"])
			continue
		var chapter := {
			"id": str(raw_chapter.get("id", "")),
			"title": str(raw_chapter.get("title", "")),
			"entries": [],
		}
		var chapter_index: int = world["chapters"].size()
		for level_id: Variant in raw_chapter["levels"]:
			var entry := _load_entry(level_id, loader, seen)
			if entry.is_empty():
				continue
			entry["world"] = world_index
			entry["chapter"] = chapter_index
			entry["number"] = entries.size() + 1
			entries.append(entry)
			chapter["entries"].append(entry)
		if not chapter["entries"].is_empty():
			world["chapters"].append(chapter)
	if not world["chapters"].is_empty():
		worlds.append(world)


func _load_entry(level_id: Variant, loader: Callable, seen: Dictionary) -> Dictionary:
	if typeof(level_id) != TYPE_STRING or (level_id as String).is_empty():
		errors.append("The campaign names a level without an id.")
		return {}
	var id: String = level_id
	if seen.has(id):
		errors.append("Level %s is placed twice." % id)
		return {}
	seen[id] = true
	var level: Variant = loader.call(id)
	var check := LevelValidator.validate_level(level)
	if not check["ok"]:
		var first: Dictionary = check["issues"][0] if not check["issues"].is_empty() else {}
		errors.append("Level %s was skipped: %s" % [id, first.get("message", "unreadable")])
		return {}
	for mechanic: Variant in level["requires"]["mechanics"]:
		if not SUPPORTED_MECHANICS.has(mechanic):
			errors.append("Level %s was skipped: it needs a newer version of the game." % id)
			return {}
	if level["slug"] != id:
		errors.append("Level %s was skipped: its file names a different level." % id)
		return {}
	return {"id": id, "level": level}
