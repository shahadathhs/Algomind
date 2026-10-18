class_name AppState
extends RefCounted
## What every screen shares: the campaign, local progress, downloaded content, and the theme.
##
## The campaign always comes from the device: the levels last downloaded from the API when there
## are any, otherwise the ones bundled with the game. `refresh_content` asks the API for newer
## levels in the background; the game is fully playable without it.

## Emitted when the campaign or the download status changed.
signal content_changed

var campaign: Campaign
var progress: ProgressStore
var content: ContentStore
var api: ApiClient
## Sound, music, and vibration; null in tests and screenshots, where the helpers do nothing.
var feedback: Feedback
## "bundled" or "downloaded": where the current campaign came from.
var source := "bundled"
## "idle", "loading", "updated", "unchanged", "offline", "disabled", or "invalid".
var sync_status := "idle"
## Why individual levels were skipped, from the last campaign build and the last download.
var sync_errors: Array[String] = []

var _bundled: Campaign


func _init(
	bundled_campaign: Campaign,
	store: ProgressStore,
	content_store: ContentStore = null,
	api_client: ApiClient = null
) -> void:
	_bundled = bundled_campaign
	campaign = bundled_campaign
	progress = store
	content = content_store if content_store != null else ContentStore.new()
	api = api_client
	_use_best_campaign()


## Plays a named sound effect when sound is on.
func sfx(effect: String) -> void:
	if feedback != null:
		feedback.play(effect)


## A short vibration when vibration is on.
func haptic(milliseconds: int) -> void:
	if feedback != null:
		feedback.buzz(milliseconds)


func is_dark() -> bool:
	match progress.settings.theme():
		"dark":
			return true
		"light":
			return false
		_:
			return DisplayServer.is_dark_mode()


func apply_theme() -> void:
	Palette.apply(is_dark())


## Downloads newer levels in the background, then rebuilds the campaign from the device.
func refresh_content() -> void:
	if api == null or not api.is_enabled():
		sync_status = "disabled"
		content_changed.emit()
		return
	sync_status = "loading"
	content_changed.emit()
	var result: Dictionary = await ContentSync.refresh(api.fetch_json, content)
	sync_status = str(result["status"])
	print(
		(
			"[algomind] content sync: %s, %d level(s) updated, %d problem(s)"
			% [sync_status, int(result["updated"]), (result["errors"] as Array).size()]
		)
	)
	sync_errors.clear()
	for message: Variant in result["errors"]:
		sync_errors.append(str(message))
	_use_best_campaign()
	content_changed.emit()


## Levels the downloaded campaign had to skip (an older game cannot play them).
func skipped_count() -> int:
	return campaign.errors.size() if source == "downloaded" else 0


func _use_best_campaign() -> void:
	var downloaded := ContentSync.build_campaign(content)
	if downloaded.entries.is_empty():
		campaign = _bundled
		source = "bundled"
	else:
		campaign = downloaded
		source = "downloaded"
