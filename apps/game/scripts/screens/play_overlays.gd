class_name PlayOverlays
extends RefCounted
## Opens the hint and pause panels over the play screen.


static func open_hint(p: PlayScreen) -> void:
	if p._overlay != null:
		return
	var overlay := HintOverlay.new()
	for hint: Variant in p._level.get("hints", []):
		overlay.hints.append(str(hint))
	overlay.closed.connect(p._close_overlay)
	p.app.sfx("hint")
	p._show_overlay(overlay)


static func open_pause(p: PlayScreen) -> void:
	if p._overlay != null:
		return
	if p._session.state == PlaySession.State.RUNNING:
		p._session.pause()
		p._refresh()
	var overlay := PauseOverlay.new()
	overlay.level_caption = "LEVEL %02d" % p._entry["number"]
	overlay.resume.connect(p._close_overlay)
	overlay.restart.connect(
		func() -> void:
			p._close_overlay()
			p._on_reset()
	)
	var here := {"back": "play", "back_args": {"level_id": p._entry["id"]}}
	overlay.how_to_play.connect(func() -> void: p.navigate.emit("how_to_play", here))
	overlay.open_settings.connect(func() -> void: p.navigate.emit("settings", here))
	overlay.back_to_levels.connect(
		func() -> void:
			p._close_overlay()
			p.go_back()
	)
	p._show_overlay(overlay)
