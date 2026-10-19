class_name PlayerResults
extends RefCounted
## What the server needs to verify and score the player's clears, and what it answered.
##
## `queue` holds, per level, the best program the player solved it with and has not yet sent. It
## is only ever read by ProgressSync, the one place that uploads. `points` is the server's answer:
## the total and the best stars and points per level. The game never computes a total itself; the
## server's total wins. Nothing here touches the network.

const VERSION := 1

var path: String
## { levelSlug: { levelVersion, slots, program } }
var queue: Dictionary = {}
## The server's total, or -1 until a sync has told us.
var total := -1
## { levelSlug: { stars, points } } as last reported by the server.
var levels: Dictionary = {}


func _init(save_path: String = "user://results.json") -> void:
	path = save_path


func load_data() -> void:
	queue = {}
	total = -1
	levels = {}
	var parsed: Variant = AtomicFile.read_json(path)
	if typeof(parsed) != TYPE_DICTIONARY or int(parsed.get("version", 0)) != VERSION:
		return
	if typeof(parsed.get("queue")) == TYPE_DICTIONARY:
		for slug: String in parsed["queue"]:
			var entry: Variant = parsed["queue"][slug]
			if _valid_entry(entry):
				queue[slug] = entry
	if typeof(parsed.get("levels")) == TYPE_DICTIONARY:
		for slug: String in parsed["levels"]:
			var item: Variant = parsed["levels"][slug]
			if typeof(item) == TYPE_DICTIONARY:
				levels[slug] = {
					"stars": int(item.get("stars", 0)), "points": int(item.get("points", 0))
				}
	total = int(parsed.get("total", -1))


func save() -> bool:
	return AtomicFile.write_json(
		path, {"version": VERSION, "queue": queue, "total": total, "levels": levels}
	)


## Remembers a solved program to send at the next sync. Per level only the program with the fewest
## slots is kept (a newer level version replaces an older one), so the queue stays small.
func queue_result(level_slug: String, level_version: int, program: Array, slots: int) -> void:
	var current: Variant = queue.get(level_slug)
	if current != null and int(current["levelVersion"]) == level_version:
		if int(current["slots"]) <= slots:
			return
	elif current != null and int(current["levelVersion"]) > level_version:
		return
	queue[level_slug] = {"levelVersion": level_version, "slots": slots, "program": program}


## Slugs with something waiting, in a stable order.
func pending() -> Array[String]:
	var slugs: Array[String] = []
	for slug: String in queue:
		slugs.append(slug)
	slugs.sort()
	return slugs


## Removes a sent entry, unless a better one replaced it while the request was in flight.
func drop_if_unchanged(level_slug: String, sent: Dictionary) -> void:
	var current: Variant = queue.get(level_slug)
	if current == null:
		return
	if (
		int(current["levelVersion"]) == int(sent["levelVersion"])
		and int(current["slots"]) >= int(sent["slots"])
	):
		queue.erase(level_slug)


## Records the server's answer to one submission.
func apply_result(level_slug: String, result: Dictionary) -> void:
	var stars := int(result.get("stars", 0))
	var points := int(result.get("points", 0))
	var known: Dictionary = levels.get(level_slug, {"stars": 0, "points": 0})
	levels[level_slug] = {
		"stars": maxi(int(known["stars"]), stars), "points": maxi(int(known["points"]), points)
	}
	total = int(result.get("total", total))


func stars_for(level_slug: String) -> int:
	return int(levels.get(level_slug, {}).get("stars", 0))


## Forgets what the previous account was told; the queue of unsent programs stays.
func clear_points() -> void:
	total = -1
	levels = {}


static func _valid_entry(entry: Variant) -> bool:
	return (
		typeof(entry) == TYPE_DICTIONARY
		and entry.has("levelVersion")
		and entry.has("slots")
		and typeof(entry.get("program")) == TYPE_ARRAY
		and not entry["program"].is_empty()
	)
