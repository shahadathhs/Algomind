class_name AppState
extends RefCounted
## What every screen shares: the campaign, local progress, and the active theme.

var campaign: Campaign
var progress: ProgressStore


func _init(loaded_campaign: Campaign, store: ProgressStore) -> void:
	campaign = loaded_campaign
	progress = store


func is_dark() -> bool:
	match progress.theme():
		"dark":
			return true
		"light":
			return false
		_:
			return DisplayServer.is_dark_mode()


func apply_theme() -> void:
	Palette.apply(is_dark())
