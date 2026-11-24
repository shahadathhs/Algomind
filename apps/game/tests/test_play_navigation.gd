extends GutTest
## Leaving the play screen and coming back (Settings, How to play, a ranking) keeps the tape, and
## NEXT opens the next level only when it is unlocked. Built headless on a campaign of four levels
## with stores of their own; nothing is drawn to a window.

const M := "MOVE_FORWARD"
const L := "TURN_LEFT"
const R := "TURN_RIGHT"
const LEVELS: Array[String] = ["nav-1", "nav-2", "nav-3", "nav-4"]
## East to the wall, a turn, and south to the target of the 6 by 3 board.
const WAY_OUT: Array[String] = [M, M, M, M, M, R, M, M]

const DAILY_FILE := "user://test_play_nav_daily.json"
const DAILY_DIR := "user://test_play_nav_daily_content"
const DAILY := "2026-10-20"


func after_each() -> void:
	for suffix in ["", ".tmp", ".bak"]:
		if FileAccess.file_exists(DAILY_FILE + suffix):
			DirAccess.remove_absolute(DAILY_FILE + suffix)
	ContentStore.new(DAILY_DIR).clear()


## The four levels in a row; `solved` are recorded as solved.
func _state(solved: Array, key: String) -> AppState:
	var campaign := Campaign.new()
	for i in LEVELS.size():
		var level := WorldSupport.level()
		level["levelId"] = LEVELS[i]
		level["slug"] = LEVELS[i]
		campaign.entries.append(
			{"id": LEVELS[i], "number": i + 1, "world": 0, "chapter": 0, "level": level}
		)
	# Stores of their own: never the real user:// data of a run of the game.
	var state := AppState.new(
		campaign,
		ProgressStore.new("user://test_%s.json" % key),
		ContentStore.new("user://test_%s_content" % key)
	)
	for id: String in solved:
		state.progress.record_completion(id, 1, WAY_OUT.size())
	return state


func _screen(state: AppState, args: Dictionary) -> PlayScreen:
	var host := Control.new()
	host.size = Vector2(390, 844)
	add_child_autofree(host)
	return WorldSupport.opened(host, state, args)


## Where the screen asks to go from now on: [target, args] for each navigation.
func _moves(screen: PlayScreen) -> Array:
	var moves: Array = []
	screen.navigate.connect(
		func(target: String, args: Dictionary) -> void: moves.append([target, args])
	)
	return moves


func _targets(moves: Array) -> Array[String]:
	var out: Array[String] = []
	for move: Array in moves:
		out.append(move[0])
	return out


func _labels(plan: Array) -> Array[String]:
	var out: Array[String] = []
	for item: Array in plan:
		out.append((item[0] as TileButton).label)
	return out


## Runs the way out to the end, so that the level is solved.
func _solve(screen: PlayScreen) -> void:
	for step in WAY_OUT:
		screen._on_command(step)
	assert_true(screen._start(PlaySession.State.PAUSED))
	while screen._session.state == PlaySession.State.PAUSED:
		screen._session.advance()
	screen._refresh()
	assert_eq(screen._session.state, PlaySession.State.SUCCEEDED)


# ---- the tape on the way back ----


func test_the_way_back_from_another_screen_rebuilds_the_tape_as_it_was() -> void:
	var state := _state([], "play_nav")
	var first := _screen(state, {"level_id": "nav-1"})
	for step in [M, "REPEAT", L, M]:
		first._on_command(step)
	var again := _screen(state, PlayReturn.args(first))
	assert_eq(again._tape.program(), first._tape.program(), "the same program is on the tape")
	assert_eq(again._tape.open_chain(), [[1]] as Array[Array], "the loop being built is open")
	assert_eq(again._tape.selected, -1, "nothing is selected")
	again._on_command(R)
	assert_eq((again._tape.nodes[1]["body"] as Array).size(), 3, "the command went into it")


func test_settings_how_to_play_and_a_ranking_lead_back_to_the_tape() -> void:
	var screen := _screen(_state([], "play_nav"), {"level_id": "nav-1"})
	screen._on_command(M)
	var moves := _moves(screen)
	PlayOverlays.open_pause(screen)
	var menu: PauseOverlay = screen._overlay
	menu.open_settings.emit()
	menu.how_to_play.emit()
	PlayShare.ranking(screen)
	assert_eq(_targets(moves), ["settings", "how_to_play", "leaderboard"] as Array[String])
	var expected := {"level_id": "nav-1", "tape": [{"op": M}]}
	for move: Array in moves:
		assert_eq(move[1]["back"], "play", "Back leads to the play screen")
		assert_eq(move[1]["back_args"], expected, "with the program that is on the tape")


func test_a_daily_keeps_its_tape_too() -> void:
	var daily := DailyStore.new(DAILY_FILE, DAILY_DIR)
	await daily.refresh(SocialFixtures.fetcher(DAILY, []))
	var state := _state([], "play_nav")
	state.daily = daily
	var first := _screen(state, {"daily": DAILY})
	assert_true(first._entry.has("daily"), "the screen plays the daily")
	first._on_command(M)
	var again := _screen(state, PlayReturn.args(first))
	assert_eq(again._entry["daily"], DAILY)
	assert_eq(again._tape.program(), [{"op": M}])


# ---- NEXT ----


func test_the_next_level_is_the_one_after_only_when_no_level_before_it_is_open() -> void:
	var state := _state([], "play_nav")
	var progress: ProgressStore = state.progress
	var campaign: Campaign = state.campaign
	var first := progress.next_unlocked(campaign, "nav-1")
	assert_eq(first, {}, "nav-2 is locked while nothing is solved")
	progress.record_completion("nav-2", 1, WAY_OUT.size())
	assert_eq(progress.next_unlocked(campaign, "nav-2"), {}, "nav-3 is locked while nav-1 is open")
	progress.record_completion("nav-1", 1, WAY_OUT.size())
	assert_eq(progress.next_unlocked(campaign, "nav-2")["id"], "nav-3", "nothing before it is open")
	assert_eq(progress.next_unlocked(campaign, "nav-4"), {}, "the last level has no next")
	assert_eq(progress.next_unlocked(campaign, "removed-level"), {}, "not in the campaign")


func test_next_is_not_offered_while_the_level_after_it_is_locked() -> void:
	# Only the third level is solved (the campaign was reordered, or the progress of another
	# device was merged). It stays replayable, but the level after it is locked.
	var screen := _screen(_state(["nav-3"], "play_nav"), {"level_id": "nav-3"})
	_solve(screen)
	var plan := _labels(PlayLayout.control_plan(screen))
	assert_eq(plan, ["LEVELS", "REPLAY"] as Array[String], "as at the end of the campaign")
	assert_false(screen._next.visible)
	var moves := _moves(screen)
	screen._on_next()
	assert_eq(moves, [], "a locked level is never opened")


func test_next_opens_the_next_level_when_it_is_unlocked() -> void:
	var screen := _screen(_state(["nav-1", "nav-2", "nav-3"], "play_nav"), {"level_id": "nav-3"})
	_solve(screen)
	var plan := _labels(PlayLayout.control_plan(screen))
	assert_eq(plan, ["LEVELS", "REPLAY", "NEXT"] as Array[String])
	assert_true(screen._next.visible)
	var moves := _moves(screen)
	screen._on_next()
	assert_eq(_targets(moves), ["play"] as Array[String])
	assert_eq(moves[0][1], {"level_id": "nav-4"})
