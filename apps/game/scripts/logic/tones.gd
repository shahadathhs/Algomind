class_name Tones
extends RefCounted
## Sound effects and music made from code, so the game ships no audio files.
##
## Everything is a short run of sine notes with a quick fade in and out, as 16-bit mono PCM.
## Nothing here is needed to understand the game: every sound mirrors something shown on screen.

const RATE := 22050


## One note per entry in `notes` ([frequency_hz, seconds]); a frequency of 0 is a rest.
static func sequence(notes: Array, volume: float) -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	for note: Array in notes:
		_append_note(samples, float(note[0]), float(note[1]), volume)
	return _to_stream(samples, false)


## A quiet looping pattern of a minor pentatonic scale, about eight seconds long.
static func music() -> AudioStreamWAV:
	var scale := [220.0, 261.63, 293.66, 329.63, 392.0, 440.0]
	var pattern := [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 3, 2, 4, 3, 1, 0]
	var samples := PackedFloat32Array()
	for step: int in pattern:
		_append_note(samples, scale[step], 0.5, 0.16)
	return _to_stream(samples, true)


static func tap() -> AudioStreamWAV:
	return sequence([[660.0, 0.04]], 0.3)


static func step() -> AudioStreamWAV:
	return sequence([[330.0, 0.05]], 0.22)


static func blocked() -> AudioStreamWAV:
	return sequence([[180.0, 0.09], [140.0, 0.12]], 0.4)


static func success() -> AudioStreamWAV:
	return sequence([[523.25, 0.1], [659.25, 0.1], [783.99, 0.1], [1046.5, 0.22]], 0.35)


static func fail() -> AudioStreamWAV:
	return sequence([[330.0, 0.1], [262.0, 0.1], [196.0, 0.2]], 0.35)


static func hint() -> AudioStreamWAV:
	return sequence([[880.0, 0.06], [0.0, 0.03], [1174.66, 0.1]], 0.28)


static func _append_note(
	samples: PackedFloat32Array, hz: float, seconds: float, volume: float
) -> void:
	var count := int(seconds * RATE)
	var fade := mini(int(0.008 * RATE), count / 2)
	for i in count:
		var envelope := 1.0
		if i < fade:
			envelope = float(i) / float(fade)
		elif i > count - fade:
			envelope = float(count - i) / float(fade)
		var value := 0.0 if hz <= 0.0 else sin(TAU * hz * float(i) / RATE)
		samples.append(value * volume * envelope)


static func _to_stream(samples: PackedFloat32Array, loops: bool) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32767.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = RATE
	stream.stereo = false
	stream.data = bytes
	if loops:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin = 0
		stream.loop_end = samples.size()
	return stream
