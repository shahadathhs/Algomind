class_name PlayAnimator
extends RefCounted
## Shows one simulation event: the automaton and tape slide, a blocked move nudges. Displays what
## the simulation decided and never changes it.

const NUDGE_SECONDS := 0.08


## Animates `entry`. Returns false when the run was stopped meanwhile (`id` no longer current).
static func show_step(p: PlayScreen, id: int, entry: Dictionary) -> bool:
	p._tape_view.running = true
	p._tape_view.failed_index = -1
	p._set_head(entry)
	p._board.facing = entry["direction"]
	var cell: Array = entry["position"]
	var target := Vector2(int(cell[0]), int(cell[1]))
	var blocked := str(entry["event"]).begins_with("BLOCKED")
	if blocked:
		p.app.sfx("blocked")
		p.app.haptic(40)
	else:
		p.app.sfx("step")
	var seconds: float = p.app.progress.settings.step_seconds()
	var slide := 0.0 if p.app.progress.settings.reduce_motion() else seconds
	if slide > 0.0:
		var tween := p.create_tween().set_parallel(true)
		tween.tween_property(p._board, "automaton", target, slide)
		tween.tween_property(
			p._tape_view, "scroll", p._tape_view.head_scroll(p._tape_view.current), slide
		)
		await tween.finished
	else:
		p._board.automaton = target
		p._tape_view.scroll = p._tape_view.head_scroll(p._tape_view.current)
	if id != p._run_id:
		return false
	if blocked and slide > 0.0:
		await _nudge(p, entry["direction"])
	elif slide == 0.0:
		# Reduce motion: a short beat so each step is still readable.
		await p.get_tree().create_timer(seconds).timeout
	return id == p._run_id


static func _nudge(p: PlayScreen, direction: String) -> void:
	var delta: Array = ContractLimits.DIRECTION_DELTAS[direction]
	var push := Vector2(float(delta[0]), float(delta[1])) * 0.15
	var tween := p.create_tween()
	tween.tween_property(p._board, "nudge", push, NUDGE_SECONDS)
	tween.tween_property(p._board, "nudge", Vector2.ZERO, NUDGE_SECONDS)
	await tween.finished
