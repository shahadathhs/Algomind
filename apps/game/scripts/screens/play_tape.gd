class_name PlayTape
extends RefCounted
## Keeps the tape, the board and the run button of the play screen in step with the session.


## Points the read-head at the cell the last shown event ran, shows its loop round and which
## commands of the IF branches have run.
static func set_head(p: PlayScreen, entry: Dictionary) -> void:
	p._tape_view.executed = PlayView.executed_paths(p._session)
	if entry.is_empty():
		p._tape_view.current = 0 if p._tape_view.running else -1
		p._tape_view.current_round = 0
		return
	p._tape_view.current = p._tape.cell_for_node(entry["node"])
	p._tape_view.current_round = int(entry["round"]) if entry["round"] != null else 0


## Puts the tape where it belongs for the current state: the read-head while a run is shown,
## otherwise the end of the program. Depends on the tape's width, so it also runs after layout.
static func sync_scroll(p: PlayScreen) -> void:
	var view := p._tape_view
	if view.running:
		view.scroll = view.head_scroll(view.current)
	elif p._tape.selected >= 0:
		# Keep the tile being edited in view; do not jump to the end of the program.
		view.reveal(p._tape.selected)
	else:
		view.scroll = view.edit_scroll()
	view.queue_redraw()


static func set_run_button(p: PlayScreen, label: String, icon: String, disabled: bool) -> void:
	p._run.label = label
	p._run.icon = icon
	p._run.accessibility_name = label
	p._run.set_disabled(disabled)
	p._run.queue_redraw()


## Shows the board for the session's current cursor, without animation.
static func show_board(p: PlayScreen) -> void:
	var auto := p._session.automaton_state()
	p._board.show_state(
		auto["position"], auto["direction"], p._session.trail(), p._session.blocked_cell()
	)
