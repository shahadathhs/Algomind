class_name PlayDebug
extends RefCounted
## Debug screenshots only (see main.gd): put a program on the tape and show a point of its run.

const LETTERS := {"M": "MOVE_FORWARD", "L": "TURN_LEFT", "R": "TURN_RIGHT"}


## Puts `program_text` on the tape and shows the state after `steps` events (-1 for the whole
## run, 0 for none). Writes no progress.
static func show(p: PlayScreen, program_text: String, steps: int) -> void:
	p.persist = false
	_fill_tape(p._tape, program_text)
	p._tape.clear_selection()
	if steps != 0 and p._session.start(p._tape.program(), PlaySession.State.PAUSED):
		var count: int = p._session.trace().size() if steps < 0 else steps
		for step in count:
			p._session.advance()
		if p._session.state == PlaySession.State.SUCCEEDED:
			p.app.progress.record_completion(
				p._entry["id"], int(p._level["levelVersion"]), p._tape.slots()
			)
	p._refresh()


## Letters are commands; "3{MRML}" is a loop of three rounds over that body.
static func _fill_tape(tape: TapeModel, program_text: String) -> void:
	var i := 0
	while i < program_text.length():
		var letter := program_text[i]
		if letter.is_valid_int():
			var end := i
			while end < program_text.length() and program_text[end].is_valid_int():
				end += 1
			var close := program_text.find("}", end)
			var open_end := close < 0
			if open_end:
				close = program_text.length()
			tape.append(TapeModel.REPEAT)
			tape.adjust_count(
				int(program_text.substr(i, end - i)) - ContractLimits.REPEAT_COUNT_MIN
			)
			for inner in program_text.substr(end + 1, close - end - 1):
				tape.append(LETTERS.get(inner, "MOVE_FORWARD"))
			# No closing brace leaves the loop open, as while the player is still building it.
			if not open_end:
				tape.end_loop()
			i = close + 1
			continue
		tape.append(LETTERS.get(letter, "MOVE_FORWARD"))
		i += 1
