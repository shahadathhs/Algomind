# @algomind/level-contract

The single source of truth for the level data format, its validation, the reference simulator, the solver, and the language-neutral fixture suite. The Godot game implements the same rules in GDScript and must pass every fixture in `fixtures/`; a disagreement between the two implementations blocks merge (see `docs/README_ARCHITECTURE.md`, sections 5 and 12).

This README is written so that the rules can be implemented in another language without reading the TypeScript. `fixtures/README.md` specifies the fixture file format.

## Layout

```
schema/level.v1.schema.json            JSON Schema (draft 2020-12) of the public level
schema/level-authoring.v1.schema.json  the same plus the required referenceSolution
src/constants.ts                       limits, command names, directions, patterns
src/types.ts                           TypeScript types
src/validate.ts                        validateLevel, validateAuthoringLevel, validateProgram
src/simulate.ts                        simulate
src/explain.ts                         explainResult (all player-facing failure text)
src/solve.ts                           solve
fixtures/                              levels (valid, invalid), runs, solver; see fixtures/README.md
test/                                  node --test suites, including one that runs every fixture
dist/                                  compiled output (git-ignored, produced by `pnpm build`)
```

The JSON Schema describes structure only. Rules that look at several fields at once (cells inside the board, duplicate walls, start or goal on a wall, goal equals start, duplicate commands and mechanics) are enforced by the validator. The validator is authoritative; the schema is for documentation and editor support.

## The level

```json
{
  "schemaVersion": 1,
  "levelId": "level-intro-001",
  "levelVersion": 1,
  "slug": "first-steps",
  "title": "First Steps",
  "description": "Reach the goal using the available commands.",
  "difficulty": "easy",
  "requires": { "mechanics": [] },
  "board": {
    "width": 5,
    "height": 5,
    "walls": [
      [1, 1],
      [1, 2],
      [3, 3]
    ]
  },
  "initialState": { "position": [0, 4], "direction": "north" },
  "availableCommands": ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"],
  "constraints": { "maxCommands": 12, "maxSteps": 30 },
  "goal": { "type": "reach_tile", "position": [4, 0] },
  "hints": ["Look for a route around the wall."]
}
```

There is no `sortOrder`: placement in a world and chapter is campaign data, not part of a level. Unknown fields are rejected everywhere (use `requires.mechanics` and, later, a typed `entities` array for new mechanics). The authoring form adds `referenceSolution` (a program) and is never served publicly; the public validator rejects a level that contains it.

### Coordinates and directions

- A cell is `[x, y]`. `x` grows to the right, `y` grows downward; `[0, 0]` is the top-left cell. Both are zero-based.
- Directions are `north`, `east`, `south`, `west`. `north` means `y` decreases. Unit steps: north `(0, -1)`, east `(+1, 0)`, south `(0, +1)`, west `(-1, 0)`.
- Turning left (counterclockwise): north -> west -> south -> east -> north. Turning right (clockwise): north -> east -> south -> west -> north.

### Programs

A program is an ordered list of instruction nodes: `[{ "op": "MOVE_FORWARD" }, { "op": "TURN_LEFT" }]`. The nodes (not bare strings) leave room for `REPEAT` to nest instructions later. The first schema supports only flat lists of the three commands. An empty program is valid.

### Limits

All are inclusive. Lengths of strings are counted in Unicode code points (not UTF-16 units or bytes). They live in `src/constants.ts` (`LIMITS`), and a test keeps the JSON Schema in sync.

| Field                         | Limit                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `schemaVersion`               | must be `1`                                                                                              |
| `levelId`, `slug`             | 1 to 64 characters, lowercase letters and digits in hyphen-separated groups (`^[a-z0-9]+(-[a-z0-9]+)*$`) |
| `levelVersion`                | integer, 1 to 1,000,000                                                                                  |
| `title`                       | 1 to 60 characters                                                                                       |
| `description`                 | 0 to 280 characters                                                                                      |
| `difficulty`                  | `easy`, `medium`, or `hard`                                                                              |
| `requires.mechanics`          | at most 8 entries, unique, each 1 to 32 characters matching `^[a-z][a-z0-9_]*$`                          |
| `board.width`, `board.height` | integer, 3 to 12                                                                                         |
| `board.walls`                 | at most 100 unique cells                                                                                 |
| `availableCommands`           | 1 to 3 unique entries from `MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`                                     |
| `constraints.maxCommands`     | integer, 1 to 64                                                                                         |
| `constraints.maxSteps`        | integer, 1 to 1000                                                                                       |
| `hints`                       | at most 5 entries, each 1 to 140 characters                                                              |

`requires.mechanics` names are free-form within the pattern: the validator does not know which mechanics a game build supports; the API and the client compare the list with what they support. The first command set needs no mechanics, so the list is normally empty.

## Validation

`validateLevel(input)` and `validateAuthoringLevel(input)` take any value and return `{ ok, issues }`. They never throw. `validateProgram(level, program)` returns the same shape.

Each issue is `{ path, code, message }`, matching the error contract in `docs/README_ARCHITECTURE.md` section 11.

- `path` is JSON-pointer-like: object keys joined with `.` and array indexes in brackets, for example `board.width`, `board.walls[2]`, `initialState.position`, `referenceSolution[1].op`. The document root is the empty string `""`.
- `code` is stable and machine-readable (table below). `message` is human text and not part of the contract: never match on it, and fixtures do not contain it.
- The order of issues is not part of the contract; compare as a set of `(path, code)` pairs. A given `(path, code)` pair appears at most once.

### Issue codes

| Code                         | Meaning                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `INVALID_TYPE`               | wrong JSON type, a non-integer where an integer is required, or a malformed `[x, y]` pair |
| `REQUIRED`                   | a required field is absent                                                                |
| `UNKNOWN_FIELD`              | a field the schema does not define                                                        |
| `UNSUPPORTED_SCHEMA_VERSION` | `schemaVersion` is an integer other than 1                                                |
| `OUT_OF_RANGE`               | a number outside its inclusive range                                                      |
| `LENGTH_OUT_OF_RANGE`        | a string or array shorter or longer than allowed                                          |
| `INVALID_FORMAT`             | a string that fails its pattern (`levelId`, `slug`, mechanic names)                       |
| `INVALID_VALUE`              | a string outside its enum (`difficulty`, `initialState.direction`, `goal.type`)           |
| `OUTSIDE_BOARD`              | a wall, the start, or the goal outside the board                                          |
| `DUPLICATE_WALL`             | a wall repeats an earlier wall (reported at the later index)                              |
| `START_ON_WALL`              | the start cell is a wall                                                                  |
| `GOAL_ON_WALL`               | the goal cell is a wall                                                                   |
| `GOAL_EQUALS_START`          | the goal cell is the start cell                                                           |
| `UNKNOWN_COMMAND`            | a command name that is not one of the three (also an unknown `op` in a program)           |
| `DUPLICATE_COMMAND`          | a known command repeated in `availableCommands` (reported at the later index)             |
| `DUPLICATE_MECHANIC`         | a mechanic repeated in `requires.mechanics` (reported at the later index)                 |
| `COMMAND_NOT_AVAILABLE`      | a known `op` that the level's `availableCommands` does not offer                          |
| `TOO_MANY_COMMANDS`          | a program longer than `constraints.maxCommands`; reported at the program path             |

### Exact validation rules

1. The input must be an object (not an array, not null) or the only issue is `INVALID_TYPE` at `""`.
2. `schemaVersion`: absent is `REQUIRED`; a non-integer is `INVALID_TYPE`; an integer other than 1 is `UNSUPPORTED_SCHEMA_VERSION` **and validation stops there** (that is the only issue returned, because nothing else can be trusted). Otherwise validation continues.
3. Any key that is not a field of the level (or `referenceSolution` for the authoring validator) is `UNKNOWN_FIELD` at that key. The same applies inside `requires`, `board`, `initialState`, `constraints`, `goal`, and program nodes.
4. A missing field is `REQUIRED` at its own path. A present field of the wrong JSON type is `INVALID_TYPE`. Integers must be whole numbers (a float such as `5.5` or a string such as `"5"` is `INVALID_TYPE`, not `OUT_OF_RANGE`). A field with one error produces one issue; it is not also checked against later rules.
5. Strings: first the type, then the length (`LENGTH_OUT_OF_RANGE`; an empty string where 1 is the minimum is a length error, not a format error), then the pattern (`INVALID_FORMAT`).
6. A container that has the wrong type or is missing (`board`, `initialState`, `goal`, `requires`, `constraints`) gets one issue and its children are not checked.
7. A cell (`board.walls[i]`, `initialState.position`, `goal.position`) must be an array of exactly two integers, else `INVALID_TYPE`. If, and only if, `board.width` and `board.height` are both valid (integers within range), a cell with `x < 0`, `y < 0`, `x >= width`, or `y >= height` is also `OUTSIDE_BOARD`. So a bad board size produces no `OUTSIDE_BOARD` issues.
8. Cell comparisons use every well-formed cell, whether or not it is inside the board:
   - a well-formed wall equal to an earlier well-formed wall is `DUPLICATE_WALL` at the later index;
   - `START_ON_WALL` at `initialState.position`, `GOAL_ON_WALL` at `goal.position`, and `GOAL_EQUALS_START` at `goal.position` when both cells are well-formed.
9. `board.walls` with more than 100 entries is `LENGTH_OUT_OF_RANGE` at `board.walls` (each entry is still checked).
10. `availableCommands`: an empty array is `LENGTH_OUT_OF_RANGE`. Per entry: a non-string is `INVALID_TYPE`; a string that is not one of the three names (names are case sensitive) is `UNKNOWN_COMMAND`; a known name seen earlier is `DUPLICATE_COMMAND`.
11. `requires.mechanics`: more than 8 entries is `LENGTH_OUT_OF_RANGE` at `requires.mechanics`. Per entry: type, length, pattern as in rule 5; a valid name seen earlier is `DUPLICATE_MECHANIC`.
12. `hints`: more than 5 entries is `LENGTH_OUT_OF_RANGE` at `hints`. Per entry: type and length as in rule 5.
13. `goal.type` must be `"reach_tile"` (`INVALID_VALUE` otherwise, `REQUIRED` if absent).
14. **Goal equals start is invalid.** A level the empty program would solve is not a puzzle. (Decision; the docs were silent.)
15. A goal that cannot be reached is **not** a validation issue. The solver decides that (publish gates use `solve`).
16. Authoring only: `referenceSolution` is required and is checked like a program (below) against the level's own `availableCommands` and `constraints.maxCommands`, with paths starting `referenceSolution`. Whether it actually solves the level is checked by running `simulate`, not by the validator.

### Program validation

`validateProgram(level, program)` takes a valid level. The path prefix is `program` (`referenceSolution` for the authoring check).

1. Not an array: `INVALID_TYPE` at `program`.
2. Per node `program[i]`: not an object is `INVALID_TYPE` at `program[i]`; any key other than `op` is `UNKNOWN_FIELD` at `program[i].<key>`; missing `op` is `REQUIRED` at `program[i].op`; a non-string `op` is `INVALID_TYPE`; a string that is not a known command is `UNKNOWN_COMMAND`; a known command that is not in the level's `availableCommands` is `COMMAND_NOT_AVAILABLE`. All at `program[i].op`.
3. Length greater than `constraints.maxCommands` is a single `TOO_MANY_COMMANDS` at `program`. An empty program is valid.

## The simulator

`simulate(level, program)` is deterministic and pure: the same inputs always give the same output, nothing is modified, and there is no clock, randomness, or I/O. It is separate from animation: a game animates the returned trace.

`simulate` expects a level that passed `validateLevel` (behavior on an invalid level is undefined) and does **not** check `availableCommands` or `maxCommands`. Callers run `validateProgram` first. This is deliberate and covered by fixtures, so a port must not add extra checks inside its simulator.

### State

The automaton has a cell and a direction, starting at `initialState`. The goal is `goal.position`.

### Execution

A _step_ is one executed instruction. Every executed instruction counts as one step, turns included, and **a move that is blocked counts as a step too** (it is traced). Skipped or unreached instructions are not steps. `steps` always equals the trace length.

Run the instructions in order. For the instruction at index `i` (zero-based), with `steps` steps done so far:

1. If `steps >= constraints.maxSteps`, stop: `FAILED`, reason `STEP_LIMIT`. (So a run never executes more than `maxSteps` steps. This check happens before the instruction is looked at, so it wins over `INVALID_INSTRUCTION`.)
2. If the node is not an object with a string `op` equal to one of `MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`, stop: `FAILED`, reason `INVALID_INSTRUCTION`. The instruction is not executed and is not counted. Instructions are never silently skipped.
3. `TURN_LEFT` / `TURN_RIGHT`: rotate the direction 90 degrees, keep the cell. Append a trace entry with event `TURNED`.
4. `MOVE_FORWARD`: let `target` be the cell one unit ahead.
   - If `target` is outside the board (`x < 0`, `y < 0`, `x >= width`, `y >= height`): append a trace entry (the position is unchanged, event `BLOCKED_BY_BOUNDARY`) and stop: `FAILED`, reason `BLOCKED_BY_BOUNDARY`, `blockedCell` = `target` (which can contain `-1` or `width` / `height`).
   - Else if `target` is a wall: same, with event and reason `BLOCKED_BY_WALL`.
   - Else move to `target`. If `target` is the goal cell: append a trace entry with event `GOAL_REACHED` and stop: `SUCCEEDED`, reason `GOAL_REACHED`. Any remaining instructions are ignored (not executed, not validated, not counted). Otherwise append a trace entry with event `MOVED`.
5. If the instructions run out without a stop: `FAILED`, reason `PROGRAM_ENDED`. This includes an empty program (zero steps), and a program of exactly `maxSteps` instructions that did not reach the goal (it ends, it does not hit the limit, because the limit is only checked before an instruction that would run).

The goal is only tested when a move enters it. The start cell is never the goal in a valid level.

### Result

```json
{
  "status": "SUCCEEDED | FAILED",
  "reason": "GOAL_REACHED | BLOCKED_BY_WALL | BLOCKED_BY_BOUNDARY | PROGRAM_ENDED | STEP_LIMIT | INVALID_INSTRUCTION",
  "steps": 2,
  "finalState": { "position": [1, 2], "direction": "east" },
  "blockedCell": [2, 2],
  "trace": [
    { "index": 0, "op": "MOVE_FORWARD", "position": [1, 2], "direction": "east", "event": "MOVED" }
  ]
}
```

- `status` is `SUCCEEDED` only with reason `GOAL_REACHED`.
- `finalState` is the state after the last step (the initial state when no step ran). On a blocked move it is the state before the blocked move.
- `blockedCell` is the attempted target cell for the two `BLOCKED_BY_*` reasons, otherwise `null`. The key is always present.
- Each trace entry has exactly the keys `index` (0-based step number; equals the instruction index in flat programs), `op`, `position` and `direction` (the state **after** the step; unchanged position for a blocked move), and `event` (`MOVED`, `TURNED`, `GOAL_REACHED`, `BLOCKED_BY_WALL`, `BLOCKED_BY_BOUNDARY`). `STEP_LIMIT`, `PROGRAM_ENDED`, and `INVALID_INSTRUCTION` add no trace entry.

### Player-facing text

`explainResult(result)` maps a reason to plain language. All of it lives in `src/explain.ts` (`REASON_MESSAGES`):

| Reason                | Text                                                       |
| --------------------- | ---------------------------------------------------------- |
| `GOAL_REACHED`        | Level solved.                                              |
| `BLOCKED_BY_WALL`     | The automaton tried to move into a wall.                   |
| `BLOCKED_BY_BOUNDARY` | The automaton tried to move off the board.                 |
| `PROGRAM_ENDED`       | The program ended before the goal.                         |
| `STEP_LIMIT`          | The program ran too long and was stopped.                  |
| `INVALID_INSTRUCTION` | The program contains an instruction this level cannot run. |

The game shows these in capitals per `docs/README_VISUAL_DESIGN.md` section 7. The text is not part of the fixtures.

## The solver

`solve(level)` returns the shortest program (par), or `null` when the goal cannot be reached with the available commands.

```ts
{
  commands: number;
  steps: number;
  program: Program;
  fitsConstraints: boolean;
}
```

`commands` is the program length and equals `steps` (programs are flat, so each instruction runs once and the goal is reached on the last one). `fitsConstraints` is `commands <= constraints.maxCommands && steps <= constraints.maxSteps`. The search ignores both constraints; a `false` means the level's budget is below par.

It is a breadth-first search over the states `(x, y, facing)`. The tie-breaking is specified so another language produces the **same program**, not only the same length:

1. The queue is FIFO and starts with the initial state, which is marked discovered.
2. Dequeue a state and try the available commands in this fixed order: `MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`. Commands not in `availableCommands` are skipped.
3. `MOVE_FORWARD` produces no new state if the cell ahead is off the board or a wall. Otherwise it produces the state with the new cell and the same facing. A turn produces the state with the same cell and the new facing.
4. If the produced state was already discovered, ignore it. Otherwise mark it discovered, remember the dequeued state as its parent and the command used, and append it to the queue.
5. **Stop at the first discovered state whose cell is the goal cell** (checked at the moment of discovery, not when dequeued). The program is the commands on the path from the start to that state.
6. If the queue empties, return `null`.

Because parents are recorded on first discovery and commands are tried in a fixed order, the result is unique. Examples: facing north with the goal directly behind gives `TURN_LEFT, TURN_LEFT, MOVE_FORWARD` (not the equally short `TURN_RIGHT` twin), and a detour that could pass above or below a wall takes the route whose first differing command comes earlier in the order `MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`. If the start were the goal (invalid level), the result would be the empty program with 0 commands.

## Using the package

It ships compiled JavaScript and type declarations in `dist/` as an ES module with no runtime dependencies (the standard library only), so it loads in Node 22 (NestJS built with SWC) and in Next.js 16 alike. Import with the package name:

```ts
import { validateLevel, simulate, solve, explainResult } from "@algomind/level-contract";
import schema from "@algomind/level-contract/schema/level.v1.schema.json" with { type: "json" };
```

The package is private to the workspace; add `"@algomind/level-contract": "workspace:*"` to a consumer's dependencies and run `pnpm build` in this package (or `pnpm --filter @algomind/level-contract build`) before the consumer is built or tested, because `exports` points at `dist/`.

Public API: `validateLevel`, `validateAuthoringLevel`, `validateProgram`, `simulate`, `solve`, `explainResult`, `REASON_MESSAGES`, the small helpers `turn`, `cellAhead`, `isWall`, `isInsideBoard`, the constants (`LIMITS`, `COMMAND_NAMES`, `DIRECTIONS`, `DIFFICULTIES`, `DIRECTION_DELTAS`, `SCHEMA_VERSION`), and the types.

## Scripts

```sh
pnpm --filter @algomind/level-contract build       # tsc -> dist/
pnpm --filter @algomind/level-contract typecheck   # builds, then type-checks src and the tests
pnpm --filter @algomind/level-contract test        # builds, then node --test
```

## Fixtures for other implementations

Read `fixtures/README.md`. In short: every file in `fixtures/` is self-describing JSON. A GDScript (or any other) implementation loads each directory, runs its own validator, simulator, and solver on the `level` / `program` in each file, and compares to the expected values in the same file. Adding a case means adding a file; no test code changes. An implementation passes when every fixture matches exactly.

A new rule, command, or mechanic changes this README, the fixtures, and both implementations in the same change.
