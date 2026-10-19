class_name PlayLayout
extends RefCounted
## Places the play screen's children for the current size and session state.

const GAP := 10.0


static func apply(p: PlayScreen) -> void:
	var m := p.margin()
	var compact := p.size.y < 760.0
	var control_h := 48.0 if compact else 56.0
	var width := p.size.x - 2.0 * m
	var y := p.inset_top() + (12.0 if compact else 28.0)
	y = _header(p, m, y, width, compact)
	y = _objective(p, m, y, width, compact)

	var controls_y := p.size.y - p.inset_bottom() - m - control_h
	var row_y := controls_y - 10.0 - control_h
	var cursor := _tape_area(p, m, row_y - (10.0 if compact else 6.0), width, compact)
	var board_h := cursor - y
	var side := minf(width, board_h)
	p._board.size = Vector2(side, side)
	p._board.position = Vector2((p.size.x - side) / 2.0, y + (board_h - side) / 2.0)

	var row_nodes: Array = []
	row_nodes.append_array(p._command_buttons)
	row_nodes.append_array(p._stats)
	p._sync_tape_scroll()
	_place_row(row_nodes, row_y, control_h, width, m)
	_place_controls(p, controls_y, control_h, width, m)
	p._commands_caption.visible = not compact and not p._session.is_finished()


## The back, title, hint and menu row. Returns the y below it.
static func _header(p: PlayScreen, m: float, y: float, width: float, compact: bool) -> float:
	p._back.position = Vector2(m, y)
	p._back.size = Vector2(44.0, 44.0)
	p._menu.position = Vector2(p.size.x - m - 44.0, y)
	p._menu.size = Vector2(44.0, 44.0)
	p._help.position = Vector2(p.size.x - m - 96.0, y)
	p._help.size = Vector2(44.0, 44.0)
	p._caption.position = Vector2(m + 54.0, y)
	p._caption.size = Vector2(width - 158.0, 18.0)
	p._title.position = Vector2(m + 54.0, y + 16.0)
	p._title.size = Vector2(width - 158.0, 30.0)
	return y + 44.0 + (10.0 if compact else 12.0)


## The objective message, result badge and command counter. Returns the y below them.
static func _objective(p: PlayScreen, m: float, y: float, width: float, compact: bool) -> float:
	var objective_h := 52.0 if compact else 54.0
	var finished := p._session.is_finished()
	var counter_w := 0.0 if finished else 150.0
	var badge_w := 40.0 if finished else 0.0
	p._badge.visible = finished
	p._badge.position = Vector2(m, y + (objective_h - 28.0) / 2.0)
	p._badge.size = Vector2(28.0, 28.0)
	p._message.position = Vector2(m + badge_w, y)
	p._message_box = Vector2(
		width - badge_w - counter_w - (8.0 if counter_w > 0.0 else 0.0), objective_h
	)
	p._message.size = p._message_box
	p._settle_message()
	p._counter.position = Vector2(p.size.x - m - 150.0, y)
	p._counter.size = Vector2(150.0, objective_h)
	return y + objective_h + 8.0


## Stacks the commands caption, coach, tape and tape tools upward from `cursor`. Returns the y of
## the top of the stack, which is where the board ends.
static func _tape_area(
	p: PlayScreen, m: float, cursor: float, width: float, compact: bool
) -> float:
	if not compact:
		p._commands_caption.position = Vector2(m, cursor - 18.0)
		p._commands_caption.size = Vector2(width, 18.0)
		cursor -= 18.0 + 14.0
	var coach_h := 40.0
	if p._coach.visible:
		p._coach.position = Vector2(m, cursor - coach_h)
		p._coach.size = Vector2(width, coach_h)
		cursor -= coach_h + 8.0
	var tape_h := 84.0 if compact else 112.0
	p._tape_view.position = Vector2(m, cursor - tape_h)
	p._tape_view.size = Vector2(width, tape_h)
	cursor = p._tape_view.position.y - 6.0
	var caption_h := 40.0 if compact else 44.0
	p._program_caption.position = Vector2(m, cursor - caption_h)
	p._program_caption.size = Vector2(width * 0.4, caption_h)
	var tool_size := caption_h - 4.0
	var shown: Array[TileButton] = []
	for tool in p._tools:
		if tool.visible:
			shown.append(tool)
	for i in shown.size():
		shown[i].size = Vector2(tool_size, tool_size)
		shown[i].position = Vector2(
			p.size.x - m - (shown.size() - i) * (tool_size + 8.0) + 8.0, cursor - caption_h + 2.0
		)
	return p._program_caption.position.y - 4.0


## Places equal-width controls in one row; hidden ones are skipped.
static func _place_row(nodes: Array, row_y: float, height: float, width: float, m: float) -> void:
	var visible_nodes: Array[Control] = []
	for node: Control in nodes:
		if node.visible:
			visible_nodes.append(node)
	if visible_nodes.is_empty():
		return
	var each := floorf((width - GAP * (visible_nodes.size() - 1)) / visible_nodes.size())
	for i in visible_nodes.size():
		visible_nodes[i].position = Vector2(m + i * (each + GAP), row_y)
		visible_nodes[i].size = Vector2(each, height)


static func _place_controls(
	p: PlayScreen, row_y: float, height: float, width: float, m: float
) -> void:
	var rows: Array = p._control_plan()
	var total_weight := 0.0
	for item: Array in rows:
		total_weight += float(item[1])
	var x := m
	for item: Array in rows:
		var button: TileButton = item[0]
		var w := floorf((width - GAP * (rows.size() - 1)) * float(item[1]) / total_weight)
		button.position = Vector2(x, row_y)
		button.size = Vector2(w, height)
		x += w + GAP
