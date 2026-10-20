class_name ContractLimits
extends RefCounted
## Limits, names, and patterns of the level contract (schema version 1).
## Mirrors packages/level-contract/src/constants.ts; a change to the rules changes both.

const SCHEMA_VERSION := 1

## The commands that move or turn the automaton, in the canonical order.
const PRIMITIVE_COMMANDS: Array[String] = ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"]
## The loop instruction: a count and a body of primitives. A loop cannot contain a loop.
const REPEAT_OP := "REPEAT"
## The conditional loop: it runs its body while the way ahead is open.
const REPEAT_UNTIL_OP := "REPEAT_UNTIL"
## The conditions a REPEAT_UNTIL can wait for. BLOCKED: a wall or the board edge is straight ahead.
const UNTIL_CONDITIONS: Array[String] = ["BLOCKED"]
## Every command a level can offer, in the canonical order.
const COMMAND_NAMES: Array[String] = [
	"MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT", "REPEAT", "REPEAT_UNTIL"
]
## Clockwise order: turning right moves one step forward in this list.
const DIRECTIONS: Array[String] = ["north", "east", "south", "west"]
const DIFFICULTIES: Array[String] = ["easy", "medium", "hard"]
const GOAL_TYPES: Array[String] = ["reach_tile"]

## Largest integer a JSON number may carry and still be exact (2^53 - 1).
const MAX_SAFE_INTEGER := 9007199254740991

const ID_MIN := 1
const ID_MAX := 64
const LEVEL_VERSION_MIN := 1
const LEVEL_VERSION_MAX := 1000000
const TITLE_MIN := 1
const TITLE_MAX := 60
const DESCRIPTION_MIN := 0
const DESCRIPTION_MAX := 280
const MECHANICS_MAX_COUNT := 8
const MECHANIC_MIN := 1
const MECHANIC_MAX := 32
const BOARD_SIDE_MIN := 3
const BOARD_SIDE_MAX := 12
const MAX_WALLS := 100
const MAX_COMMANDS_MIN := 1
const MAX_COMMANDS_MAX := 64
const MAX_STEPS_MIN := 1
const MAX_STEPS_MAX := 1000
const REPEAT_BODY_MIN := 1
const REPEAT_BODY_MAX := 8
const REPEAT_COUNT_MIN := 2
const REPEAT_COUNT_MAX := 11
const HINTS_MAX_COUNT := 5
const HINT_MIN := 1
const HINT_MAX := 140

## Unit steps as [dx, dy]; y grows downward, so north is -1.
const DIRECTION_DELTAS := {
	"north": [0, -1],
	"east": [1, 0],
	"south": [0, 1],
	"west": [-1, 0],
}


## True when op is the loop instruction. Safe for any value (comparing mismatched types errors).
static func is_repeat(op: Variant) -> bool:
	return typeof(op) == TYPE_STRING and op == REPEAT_OP


## True when op is the conditional loop. Safe for any value.
static func is_repeat_until(op: Variant) -> bool:
	return typeof(op) == TYPE_STRING and op == REPEAT_UNTIL_OP


## True when op is either loop instruction (a node that carries a body).
static func is_loop(op: Variant) -> bool:
	return is_repeat(op) or is_repeat_until(op)
