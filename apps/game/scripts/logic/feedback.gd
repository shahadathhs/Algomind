class_name Feedback
extends Node
## Sound, music, and vibration, each behind its own setting. Sound is never required to follow
## the game: every effect repeats something that is also shown. The device's own volume and
## mute switch apply, because the game plays through the system audio output.

const EFFECTS := ["tap", "step", "blocked", "success", "fail", "hint"]

var settings: Settings
var _streams := {}
var _sfx: AudioStreamPlayer
var _music: AudioStreamPlayer


func _init(player_settings: Settings = null) -> void:
	settings = player_settings


func _ready() -> void:
	_streams = {
		"tap": Tones.tap(),
		"step": Tones.step(),
		"blocked": Tones.blocked(),
		"success": Tones.success(),
		"fail": Tones.fail(),
		"hint": Tones.hint(),
	}
	_sfx = AudioStreamPlayer.new()
	add_child(_sfx)
	_music = AudioStreamPlayer.new()
	_music.stream = Tones.music()
	_music.volume_db = -14.0
	add_child(_music)
	apply_music()


## Plays a named effect when sound is on.
func play(effect: String) -> void:
	if settings == null or not settings.sound() or not _streams.has(effect) or _sfx == null:
		return
	_sfx.stream = _streams[effect]
	_sfx.play()


## A short vibration on a phone when vibration is on; nothing on a desktop.
func buzz(milliseconds: int) -> void:
	if settings == null or not settings.vibration():
		return
	if OS.has_feature("android") or OS.has_feature("ios"):
		Input.vibrate_handheld(milliseconds)


## Starts or stops the music to match the setting.
func apply_music() -> void:
	if _music == null or settings == null:
		return
	if settings.music():
		if not _music.playing:
			_music.play()
	else:
		_music.stop()
