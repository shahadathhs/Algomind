class_name PlayReturn
extends RefCounted
## Brings the player back to the level they were playing with the tape as they left it. The shell
## frees a screen when another one opens and builds it again on the way back (from Settings, How
## to play, or a ranking), so the tape travels in the arguments of that navigation.


## The arguments that open this level or daily again, with the tape when something is on it.
static func args(p: PlayScreen) -> Dictionary:
	var back := {"level_id": p._entry["id"]}
	if p._entry.has("daily"):
		back = {"daily": p._entry["daily"]}
	if not p._tape.is_empty():
		# The nodes as they are: what is open on the tape is a flag inside its node, so a loop or
		# an IF being built is still open on the way back.
		back["tape"] = p._tape.nodes.duplicate(true)
	return back


## For a screen opened over the play screen: where its Back leads.
static func target(p: PlayScreen) -> Dictionary:
	return {"back": "play", "back_args": args(p)}
