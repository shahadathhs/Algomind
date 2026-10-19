extends Control
## The shell: loads the campaign and progress once, shows one screen at a time, and handles the
## Android back button. Screens never know about each other; they ask to navigate by name.

const SCREENS := {
	"home": "res://scenes/home.tscn",
	"worlds": "res://scenes/worlds.tscn",
	"world": "res://scenes/world.tscn",
	"play": "res://scenes/play.tscn",
	"sign_in": "res://scenes/sign_in.tscn",
	"account": "res://scenes/account.tscn",
	"how_to_play": "res://scenes/how_to_play.tscn",
	"load_error": "res://scenes/load_error.tscn",
	"update_required": "res://scenes/update_required.tscn",
	"settings": "res://scenes/settings.tscn",
}

var _state: AppState
var _screen: ScreenBase


func _ready() -> void:
	var store := ProgressStore.new()
	store.load_data()
	var options := _debug_options()
	if options.has("shot"):
		# Screenshots always use the bundled levels, never whatever is cached on this machine.
		_state = AppState.new(
			Campaign.load_bundled(), store, ContentStore.new("user://content_shot")
		)
		_debug_screenshot(options)
		return
	var api := ApiClient.new()
	add_child(api)
	_state = AppState.new(Campaign.load_bundled(), store, ContentStore.new(), api)
	_state.feedback = Feedback.new(store.settings)
	add_child(_state.feedback)
	var account := Account.new()
	account.load_data()
	_state.account = account
	_state.account_client = AccountClient.new(account, api.send_json)
	_state.account_sync = AccountSync.new(_state.account_client, store)
	add_child(_state.account_sync)
	_state.request_sync()
	for message in _state.campaign.errors:
		push_warning(message)
	_show("home", {})
	_state.refresh_content()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST and _screen != null:
		_screen.go_back()


func _show(target: String, args: Dictionary) -> void:
	_state.apply_theme()
	if _screen != null and _screen.get_parent() != null:
		_screen.get_parent().remove_child(_screen)
		_screen.queue_free()
	var packed: PackedScene = load(SCREENS[target])
	_screen = packed.instantiate()
	_screen.setup(_state, args)
	_screen.navigate.connect(_on_navigate)
	add_child(_screen)


func _on_navigate(target: String, args: Dictionary) -> void:
	_show.call_deferred(target, args)


# ----- debug screenshots (not available in release builds) -----
# godot --path apps/game -- --shot=out.png --screen=play --level=the-wall --theme=dark
#   --size=390x844 --program=MMLMM --steps=-1 --done=3
# Renders one screen into an off-screen viewport of the given size, saves a PNG, and quits.


func _debug_options() -> Dictionary:
	var options := {}
	if not OS.is_debug_build():
		return options
	for argument in OS.get_cmdline_user_args():
		var parts := argument.trim_prefix("--").split("=", true, 1)
		options[parts[0]] = parts[1] if parts.size() > 1 else ""
	return options


func _debug_screenshot(options: Dictionary) -> void:
	var dimensions := String(options.get("size", "390x844")).split("x")
	var viewport := SubViewport.new()
	viewport.size = Vector2i(int(dimensions[0]), int(dimensions[1]))
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)

	if options.has("account"):
		# Pretend a player is signed in (nothing is sent anywhere).
		var shot_account := Account.new("user://account_shot.json")
		shot_account.start(String(options["account"]), "shot-refresh-token")
		shot_account.last_sync_at = Time.get_unix_time_from_system() - 120.0
		_state.account = shot_account
	_state.progress.settings.set_theme(String(options.get("theme", "light")))
	_state.progress.settings.set_reduce_motion(true)
	for i in int(options.get("done", "0")):
		var entry: Dictionary = _state.campaign.entries[i]
		_state.progress.record_completion(entry["id"], int(entry["level"]["levelVersion"]), 5)
	_state.apply_theme()

	var target := String(options.get("screen", "home"))
	var packed: PackedScene = load(SCREENS[target])
	var screen: ScreenBase = packed.instantiate()
	var level_id := String(options.get("level", _state.campaign.entries[0]["id"]))
	if options.has("loops"):
		# Debug only: let this level offer REPEAT (no loop level is published yet), with a roomier limit.
		var level: Dictionary = _state.campaign.entry_by_id(level_id)["level"]
		level["availableCommands"].append("REPEAT")
		level["constraints"]["maxCommands"] = 12
	var screen_args := {
		"level_id": level_id,
		"world": int(options.get("world", "0")),
		"title": String(options.get("title", "Around the wall")),
	}
	screen.setup(_state, screen_args)
	if target == "play":
		screen.persist = false
	viewport.add_child(screen)
	await get_tree().process_frame
	if target == "play" and options.has("program"):
		screen.debug_show(String(options["program"]), int(options.get("steps", "0")))
	if target == "play" and options.has("select"):
		screen.debug_select(int(options["select"]))
	if target == "play" and options.has("overlay"):
		screen.debug_overlay(String(options["overlay"]))
	# Controls settle their size over a few frames; wait before capturing.
	for i in 8:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := viewport.get_texture().get_image()
	image.save_png(String(options["shot"]))
	get_tree().quit()
