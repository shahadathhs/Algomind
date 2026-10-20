class_name PlayView
extends RefCounted
## Texts and tool states of the play screen, derived from the session and the tape.


## Shows the tools that apply to the selected cell: rounds only for a loop's count tile.
static func refresh_tools(p: PlayScreen) -> void:
	var tape := p._tape
	var tools := p._tools
	var has_selection := tape.selected >= 0 and not p._session.is_active()
	var is_count := tape.selected_is_count()
	# Order: minus, plus, earlier, later, remove.
	tools[0].visible = has_selection and is_count
	tools[1].visible = has_selection and is_count
	for i in range(2, 5):
		tools[i].visible = has_selection
	if not has_selection:
		return
	var path: Array = tape.cells()[tape.selected]["path"]
	var siblings := (
		tape.nodes.size()
		if path.size() == 1
		else (tape.nodes[int(path[0])]["body"] as Array).size()
	)
	var place := int(path[path.size() - 1])
	tools[2].set_disabled(place <= 0)
	tools[3].set_disabled(place >= siblings - 1)
	var count := int(tape.cells()[tape.selected].get("count", 0))
	tools[0].set_disabled(count <= ContractLimits.REPEAT_COUNT_MIN)
	tools[1].set_disabled(count >= ContractLimits.REPEAT_COUNT_MAX)


## The text at the right of the objective row: commands used while building, and the stars and
## points of a solved level (a provisional score; the server's total wins at the next sync).
static func counter_text(p: PlayScreen) -> String:
	if p._session.state != PlaySession.State.SUCCEEDED:
		return "%d / %d COMMANDS" % [p._tape.slots(), p._tape.limit]
	var par: Dictionary = p._entry.get("par", {})
	if not par.has("commands") or not par.has("steps"):
		return "SOLVED"
	var score := (
		Scoring
		. score_result(
			Scoring.DEFAULT_RULES,
			{
				"difficulty": p._level["difficulty"],
				"par": par,
				"slots": p._tape.slots(),
				"steps": int(p._session.result.get("steps", 0)),
			}
		)
	)
	if p._entry.has("daily"):
		return "%d / 3 STARS" % score["stars"]
	return "%d / 3 STARS\n%d POINTS" % [score["stars"], score["levelScore"]]


static func message_text(p: PlayScreen) -> String:
	match p._session.state:
		PlaySession.State.SUCCEEDED, PlaySession.State.FAILED:
			return ResultMessages.for_result(p._session.result).to_upper().trim_suffix(".")
		_:
			if p._tape.has_empty_loop():
				return "ADD A COMMAND TO THE LOOP"
			return "REACH THE TARGET"


static func update_stats(p: PlayScreen) -> void:
	var stats := p._stats
	var best := p.app.progress.best_commands(p._entry["id"], int(p._level["levelVersion"]))
	if p._entry.has("daily"):
		best = int(p.app.progress.results.daily_best.get(p._entry["daily"], {}).get("slots", 0))
	stats[0].value = "%d / %d" % [p._tape.slots(), p._tape.limit]
	stats[1].value = str(int(p._session.result.get("steps", 0)))
	var par: Dictionary = p._entry.get("par", {})
	if par.has("commands"):
		stats[2].caption = "BEST / PAR"
		stats[2].value = "%s / %d" % [str(best) if best > 0 else "-", int(par["commands"])]
	else:
		stats[2].caption = "BEST"
		stats[2].value = str(best) if best > 0 else "-"
	for stat in stats:
		stat.queue_redraw()


## The first-run coach on level 1: step 1 until a command is added, step 2 until the run starts.
static func update_coach(p: PlayScreen, state: PlaySession.State) -> void:
	var coach := p._coach
	var active := (
		int(p._entry["number"]) == 1
		and not p.app.progress.settings.tutorial_done()
		and state == PlaySession.State.READY
	)
	coach.visible = active
	if not active:
		return
	if p._tape.is_empty():
		coach.step_number = 1
		coach.text = "TAP MOVE TO ADD A COMMAND"
	else:
		coach.step_number = 2
		coach.text = "TAP RUN TO START YOUR PROGRAM"
	coach.queue_redraw()
