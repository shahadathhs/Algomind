extends ScreenBase
## How to play: the commands, loops, the controls, and what a failure message means. Reached from
## the pause menu; Back returns to where it was opened from.

const COMMANDS: Array[Dictionary] = [
	{
		"icon": "move",
		"name": "MOVE",
		"text": "Moves one cell in the direction the automaton faces."
	},
	{"icon": "left", "name": "LEFT", "text": "Turns a quarter turn to the left. It does not move."},
	{
		"icon": "right",
		"name": "RIGHT",
		"text": "Turns a quarter turn to the right. It does not move."
	},
	{
		"icon": "repeat",
		"name": "REPEAT",
		"text": "Starts a loop. Add commands to it, then tap END LOOP."
	},
	{
		"icon": "until",
		"name": "UNTIL",
		"text": "Starts a loop that repeats until a wall or the edge is straight ahead."
	},
	{
		"icon": "if",
		"name": "IF",
		"text": "Starts a decision. Add commands, tap ELSE for the others, then tap END IF."
	},
]
const SENSORS: Array[Dictionary] = [
	{"icon": "ahead", "name": "AHEAD", "text": "True when the cell straight ahead is open."},
	{"icon": "sense_left", "name": "LEFT", "text": "True when the cell to the left is open."},
	{"icon": "sense_right", "name": "RIGHT", "text": "True when the cell to the right is open."},
]
const CONTROLS: Array[Dictionary] = [
	{"icon": "play", "name": "RUN", "text": "Carries out the whole program, one step at a time."},
	{"icon": "step", "name": "STEP", "text": "Carries out one instruction, then waits."},
	{
		"icon": "reset",
		"name": "RESET",
		"text": "Puts the automaton back at the start. The program stays."
	},
]

var _back: TileButton
var _title: Label
var _scroll: ScrollContainer
var _list: VBoxContainer


func _build() -> void:
	_back = TileButton.make(TileButton.Kind.SECONDARY, "", "back")
	_back.accessibility_name = "Back"
	_back.pressed.connect(go_back)
	add_child(_back)
	_title = UiKit.label("HOW TO PLAY", 34, Palette.INK, 1)
	add_child(_title)

	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	add_child(_scroll)
	_list = VBoxContainer.new()
	_list.add_theme_constant_override("separation", 12)
	_scroll.add_child(_list)

	_list.add_child(
		_paragraph(
			(
				"Build a program from instruction tiles on the tape. Run it and the automaton "
				+ "carries out each tile in order. Reach the target to solve the level."
			)
		)
	)
	_list.add_child(UiKit.label("COMMANDS", 14, Palette.MUTE, 3))
	for item in COMMANDS:
		_list.add_child(_Row.make(item["icon"], item["name"], item["text"]))
	_list.add_child(UiKit.label("LOOPS", 14, Palette.MUTE, 3))
	_list.add_child(
		_paragraph(
			(
				"A loop carries out the commands inside it again and again. Select its count "
				+ "tile and use minus and plus to change how many rounds it runs. A loop uses "
				+ "one slot for its count and one for each command inside it. A loop cannot hold "
				+ "another loop."
			)
		)
	)
	_list.add_child(
		_paragraph(
			(
				"An UNTIL loop has no count. Before every round it looks at the cell straight "
				+ "ahead. If that cell is a wall or off the board, the loop ends and the program "
				+ "goes on after it. Otherwise it carries out the commands inside once more. "
				+ "If the way ahead is already blocked, it carries out nothing. A loop that "
				+ "never meets a wall is stopped when the program has run too long. It uses one "
				+ "slot for its header and one for each command inside it."
			)
		)
	)
	_add_decisions()
	_list.add_child(UiKit.label("CONTROLS", 14, Palette.MUTE, 3))
	for item in CONTROLS:
		_list.add_child(_Row.make(item["icon"], item["name"], item["text"]))
	_list.add_child(UiKit.label("WHEN IT FAILS", 14, Palette.MUTE, 3))
	_list.add_child(
		_paragraph(
			(
				"The game says what went wrong in plain words. It marks the wall that was hit and "
				+ "the instruction that caused it. Edit the program and run it again. There is no "
				+ "timer and no limit on tries."
			)
		)
	)


## The IF section: how a decision works and what each sensor looks at, then the GOAL condition.
func _add_decisions() -> void:
	_list.add_child(UiKit.label("IF AND SENSORS", 14, Palette.MUTE, 3))
	(
		_list
		. add_child(
			_paragraph(
				(
					"An IF looks at one cell and chooses. Select its sensor tile, then tap it again to "
					+ "switch between AHEAD, LEFT and RIGHT. A sensor is true when that cell is on the board and "
					+ "is not a wall. Looking costs no step. If the sensor is true, the commands "
					+ "under IF run. If not, the commands after ELSE run, and ELSE may stay empty."
				)
			)
		)
	)
	for item in SENSORS:
		_list.add_child(_Row.make(item["icon"], item["name"], item["text"]))
	_list.add_child(
		_paragraph(
			(
				"An IF uses one slot, plus one for each command in it. It can stand on its own "
				+ "or inside a loop. An IF cannot hold another IF or a loop. An IF needs at "
				+ "least one command before ELSE."
			)
		)
	)
	(
		_list
		. add_child(
			_paragraph(
				(
					"An UNTIL loop can also wait for the goal. Select its header tile, then tap it again to "
					+ "switch between BLOCKED and GOAL. It carries out its commands again and again until the "
					+ "automaton reaches the goal, so it keeps a program with decisions going."
				)
			)
		)
	)


func go_back() -> void:
	navigate.emit(str(args.get("back", "home")), args.get("back_args", {}))


func _layout() -> void:
	if _scroll == null:
		return
	var m := margin()
	var width := size.x - 2.0 * m
	var top := inset_top() + (28.0 if size.y >= 700.0 else 12.0)
	_back.position = Vector2(m, top)
	_back.size = Vector2(44.0, 44.0)
	_title.position = Vector2(m, top + 54.0)
	_title.size = Vector2(width, 40.0)
	var list_top := _title.position.y + 56.0
	_scroll.position = Vector2(m, list_top)
	_scroll.size = Vector2(width, size.y - inset_bottom() - m - list_top)
	_list.custom_minimum_size = Vector2(width, 0)


func _paragraph(value: String) -> Label:
	var node := UiKit.label(value, 16, Palette.INK, 0)
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return node


## One explained control: an icon tile, a name, and a sentence.
class _Row:
	extends HBoxContainer

	static func make(icon_kind: String, name_text: String, body_text: String) -> _Row:
		var row := _Row.new()
		row.add_theme_constant_override("separation", 14)
		var tile := _Tile.new()
		tile.kind = icon_kind
		tile.custom_minimum_size = Vector2(52.0, 52.0)
		row.add_child(tile)
		var column := VBoxContainer.new()
		column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		column.add_child(UiKit.label(name_text, 20, Palette.INK, 1))
		var body := UiKit.label(body_text, 15, Palette.MUTE, 0)
		body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		column.add_child(body)
		row.add_child(column)
		return row


class _Tile:
	extends Control

	var kind := "move"

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		var rect := Rect2(Vector2.ZERO, size)
		UiKit.fill_chamfer(self, rect, Palette.GROUND)
		UiKit.outline_chamfer(self, rect, Palette.INK)
		UiKit.icon(self, kind, size / 2.0, size.x * 0.5, Palette.INK)
