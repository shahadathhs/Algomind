extends ScreenBase
## Home: the wordmark, a board, Play (the one primary), and two text links.

var _wordmark: Wordmark
var _board: BoardView
var _play: TileButton
var _levels: TileButton
var _settings: TileButton
var _account: TileButton
var _notice: Label


func _build() -> void:
	_wordmark = Wordmark.new()
	add_child(_wordmark)

	_board = BoardView.new()
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	if not app.campaign.entries.is_empty():
		_board.set_level(app.campaign.entries[0]["level"])

	_play = TileButton.make(TileButton.Kind.PRIMARY, "PLAY", "", 28)
	_play.pressed.connect(_on_play)
	_play.set_disabled(app.campaign.entries.is_empty())
	add_child(_play)

	_levels = TileButton.make(TileButton.Kind.TERTIARY, "LEVELS", "", 18)
	_levels.pressed.connect(func() -> void: navigate.emit("worlds", {}))
	_levels.set_disabled(app.campaign.entries.is_empty())
	_levels.align = HORIZONTAL_ALIGNMENT_LEFT
	add_child(_levels)

	_settings = TileButton.make(TileButton.Kind.TERTIARY, "SETTINGS", "", 18)
	_settings.pressed.connect(func() -> void: navigate.emit("settings", {}))
	add_child(_settings)

	# The browser build is offline-only, so it has no account to sign in to.
	if not OS.has_feature("web"):
		_account = TileButton.make(TileButton.Kind.TERTIARY, "ACCOUNT", "", 18)
		_account.pressed.connect(
			func() -> void:
				navigate.emit("account" if app.signed_in() else "sign_in", {"back": "home"})
		)
		_account.align = HORIZONTAL_ALIGNMENT_RIGHT
		add_child(_account)
	_settings.align = (
		HORIZONTAL_ALIGNMENT_CENTER if _account != null else HORIZONTAL_ALIGNMENT_RIGHT
	)

	if app.campaign.entries.is_empty():
		_notice = UiKit.label("THE LEVELS COULD NOT LOAD", 18, Palette.INK, 1)
		_notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		add_child(_notice)


func go_back() -> void:
	get_tree().quit()


func _layout() -> void:
	if _play == null:
		return
	var m := margin()
	var width := size.x - 2.0 * m
	var top := inset_top() + (28.0 if size.y >= 700.0 else 16.0)
	_wordmark.position = Vector2(m, top)
	_wordmark.size = Vector2(width, 60.0 if size.y >= 700.0 else 48.0)

	var bottom := size.y - inset_bottom() - m
	var link_h := 48.0
	var play_h := 64.0 if size.y >= 700.0 else 56.0
	var link_w := floorf(width / (3.0 if _account != null else 2.0))
	_levels.position = Vector2(m, bottom - link_h)
	_levels.size = Vector2(link_w, link_h)
	_settings.position = Vector2(m + link_w, bottom - link_h)
	_settings.size = Vector2(link_w if _account != null else width - link_w, link_h)
	if _account != null:
		_account.position = Vector2(m + 2.0 * link_w, bottom - link_h)
		_account.size = Vector2(width - 2.0 * link_w, link_h)
	_play.position = Vector2(m, bottom - link_h - 12.0 - play_h)
	_play.size = Vector2(width, play_h)

	var free_top := _wordmark.position.y + _wordmark.size.y + 24.0
	var free_bottom := _play.position.y - 24.0
	var side := minf(minf(width * 0.8, free_bottom - free_top), 320.0)
	_board.size = Vector2(side, side)
	_board.position = Vector2(
		(size.x - side) / 2.0, free_top + (free_bottom - free_top - side) / 2.0
	)
	if _notice != null:
		_notice.position = Vector2(m, _play.position.y - 40.0)
		_notice.size = Vector2(width, 24.0)


func _on_play() -> void:
	var index := app.progress.level_to_play(app.campaign)
	if index >= 0:
		navigate.emit("play", {"level_id": app.campaign.entries[index]["id"]})
