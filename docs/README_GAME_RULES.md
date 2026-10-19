# Algomind — Game Rules & Progress Specification

> **Purpose:** The authoritative definition of how Algomind plays, how a program executes, how progress is saved and synced, and how levels are published. Other docs link here instead of repeating rules.  
> **Status:** Core decisions settled (see below). Details marked _later_ are intentionally deferred.

## Decisions at a glance

| Topic                | Decision                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Core concept         | Visual programming puzzle: build a program, run it, debug it                             |
| First command set    | `MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`                                                |
| First board cells    | Floor, Wall, Goal                                                                        |
| First win condition  | Reach the goal cell                                                                      |
| Wall or boundary hit | Execution stops and the run fails, with a clear explanation                              |
| Orientation          | Portrait-first; landscape later                                                          |
| Progress             | Local-first and offline-first; syncs to the cloud when the player signs in and is online |
| Accounts             | Optional; never required to play                                                         |
| Level delivery       | Published from the dashboard; no app rebuild for compatible levels                       |
| Production URLs      | Vercel (web) and Render (API) default URLs, known after the first deployment             |

## 1. Core game concept

Algomind is a programming puzzle game where players construct a program from visual instructions, run it, and guide an automaton to complete each level.

The player does not control the character with a joystick. Instead, they think like a programmer: plan instructions, execute them, observe the outcome, debug mistakes, and try again.

The game teaches computational thinking through play, introducing algorithmic concepts gradually. It must not require players to know programming before playing.

## 2. Core gameplay rules

Each level contains:

- A board with traversable spaces and obstacles.
- An automaton with a starting position and direction.
- A goal the automaton must reach.
- A set of available commands.
- A maximum program size (command budget) and a maximum execution-step limit.
- Optional challenge criteria, such as solving the level with fewer instructions.

### Gameplay loop

1. Open a level and understand the objective.
2. Construct a program by arranging commands.
3. Press Run to execute the program.
4. Watch the automaton perform each instruction.
5. Inspect the outcome.
6. Edit the program and retry if necessary.
7. Complete the level and unlock the next one.

There are no lives, energy systems, or timers.

### Determinism

The simulation is deterministic: the same level and the same program always produce the same outcome and the same step trace. It never depends on animation, frame rate, network, or wall-clock time. The reference simulator (TypeScript) and the game's simulator (GDScript) must agree on every shared fixture; see [README_ARCHITECTURE.md](README_ARCHITECTURE.md).

### Initial board mechanics

Start with three cell types:

- **Floor:** the automaton can move onto it.
- **Wall:** blocks movement.
- **Goal:** reaching it completes the level.

For the first version, reaching the goal completes the level. Do not introduce switches, doors, hazards, moving platforms, or collectibles until the basic gameplay is reliable.

## 3. Command set

Players build programs from a visual command palette, not a text editor. They select and arrange instructions.

### Initial commands

| Command        | Behavior                                                |
| -------------- | ------------------------------------------------------- |
| `MOVE_FORWARD` | Move one cell in the direction the automaton is facing. |
| `TURN_LEFT`    | Rotate 90 degrees counterclockwise without moving.      |
| `TURN_RIGHT`   | Rotate 90 degrees clockwise without moving.             |

These three commands are sufficient for the first levels and establish the core programming concept.

### Added after the basics work

| Command            | Behavior                                               |
| ------------------ | ------------------------------------------------------ |
| `REPEAT(n)`        | Execute a nested sequence a specified number of times. |
| `IF_FRONT_BLOCKED` | Execute a branch if the cell ahead is blocked.         |
| `INTERACT`         | Activate a supported object, such as a switch.         |

Do not implement these all at once. Introduce each command only when the level design has a reason to teach it. Each one requires a rule definition, visual treatment, tutorial level, deterministic simulation behavior, shared fixtures, tests, and a client-compatibility decision (a new command needs a client release; see section 9).

### Program rules

- Players can add, remove, and reorder commands.
- Each level defines its available commands and its program-size limit.
- The current instruction is highlighted during execution.
- Players can run, pause, step through, and reset a program.
- If the program ends without reaching the goal, the level remains incomplete.
- If the automaton tries to move into a wall or outside the board, execution stops with a clear explanation. This is a failure.
- A maximum execution-step limit prevents infinite or unexpectedly long programs.
- Invalid commands are never silently ignored.
- A `REPEAT` counts as one slot plus one slot for each instruction in its body (section 3.1), so the command limit bounds the whole program.

### Program representation

A program is an ordered list of instruction nodes (not bare strings), so `REPEAT` and `IF_FRONT_BLOCKED` can contain nested instructions later without breaking the level format. The same representation is used by the player's program, the reference solution, and the shared fixtures.

### 3.1 REPEAT (specified, not built)

> **Status:** proposed. The par search was prototyped and measured (bodies up to 8 instructions on boards up to 12 by 12 solve in 3 to 70 ms; allowing a loop inside a loop costs 0.4 to 1.8 s for little gain). Nothing in the contract, either simulator, the editor, or the game implements it yet.

A program node is either a primitive (`MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`) or a loop:

```json
{ "op": "REPEAT", "count": 6, "body": [{ "op": "MOVE_FORWARD" }, { "op": "TURN_RIGHT" }] }
```

- **Body:** one to 8 primitive instructions. A loop cannot contain a loop in version 1. Nesting would be a separate mechanic (`nested_repeat`) with its own client release.
- **Count:** a whole number from 2 to 11. One repetition is just the body, and 11 is the most that can matter on the largest board (12 cells a side).
- **Availability:** a level lists `REPEAT` in `availableCommands`. The mechanic `repeat` is derived from that (the API adds it to the required mechanics), so a client that does not declare `repeat` shows the update screen for that level and never starts it. A loop in the program of a level that does not list `REPEAT` is a content error, never silently skipped.
- **Slots (the command limit):** a primitive is 1. A `REPEAT` is 1 plus the number of instructions in its body. `maxCommands` limits the total. `REPEAT 6 { MOVE_FORWARD, TURN_RIGHT, MOVE_FORWARD, TURN_LEFT }` is 5 slots.
- **Steps:** each executed primitive is one step, as before. The `REPEAT` node itself costs no step. The step limit is checked before every primitive, including inside the loop.
- **Reaching the goal:** the run succeeds the moment the automaton enters the goal, even in the middle of an iteration or of a loop. The rest of the program does not run and is not counted. A body or iteration may therefore be left unfinished.
- **Failure:** a blocked move inside a loop stops the run. The failing tile is the body instruction that was blocked. The message and the tape also show the iteration ("Round 3 of 6").
- **Par:** the fewest slots of any program that solves the level, searched exactly over loop bodies of up to 8 instructions. The solver is TypeScript only (the API publish gate and the dashboard); the game never needs it. The reference solution may use `REPEAT`.
- **Why the metric is slots, not steps:** a loop that repeats a body costs 1 plus the body, whatever the count. A long straight corridor is cheap (`REPEAT 9 { MOVE_FORWARD }` is 2 slots), so a level only needs an algorithm when its structure repeats in a way a plain run of moves cannot capture (stairs, notches, repeated rooms).

**Level design rules for loop levels** (checked by the candidate generator, and by the publish gate where it can be checked mechanically):

1. **Loop par below flat par:** the shortest program without `REPEAT` must be larger than `maxCommands`, so a loop is required, not merely allowed.
2. **The limit sits at or just above loop par.** The intended pattern must fit; the corridor shortcut must not.
3. **No accidental shortcuts:** cells on a corridor must not touch another part of the path, or the board solves with a plain run. The solver finds these (a "teeth" candidate with flat par 6 and loop par 2 was caught this way).
4. **Check par with the solver, never by eye.** On open boards the solver finds patterns the author did not intend (a free 10 by 10 board was solved by `REPEAT 9 { M R M L }`).

**Editing:** the palette gains a Repeat tile. Tapping it appends a group with a count of 2 and an empty body that takes the next tapped commands until it is closed; the count is changed with minus and plus tiles on the group. A group is drawn as a count tile followed by its body tiles inside one outlined bracket. Visual rules are in [README_VISUAL_DESIGN.md](README_VISUAL_DESIGN.md) (to be updated when this is built).

## 4. Execution model and feedback

### Controls

- **Run:** execute automatically at a readable speed.
- **Step:** execute one primitive action at a time.
- **Pause/Resume:** stop or continue execution.
- **Reset:** restore the initial simulation state while preserving the program.
- **Retry:** allow edits after a failure.
- **Success feedback:** clearly communicate that the objective is complete.

### Execution states

Use explicit states: `READY`, `RUNNING`, `PAUSED`, `SUCCEEDED`, `FAILED`.

The program cannot be edited while `RUNNING`. Editing from `PAUSED`, `SUCCEEDED`, or `FAILED` returns the simulation to `READY`.

### Outcomes and messages

| Outcome                     | Example message                              |
| --------------------------- | -------------------------------------------- |
| Succeeded                   | “Level solved.”                              |
| Failed: blocked by a wall   | “The automaton tried to move into a wall.”   |
| Failed: blocked by the edge | “The automaton tried to move off the board.” |
| Failed: program ended       | “The program ended before the goal.”         |
| Failed: step limit          | “The program ran too long and was stopped.”  |

Exact counting rules (implemented and tested in `packages/level-contract`, whose README is the authority):

- Every executed instruction is one **step**, turns and blocked moves included. A blocked move stops the run as a failure.
- The run **succeeds the moment the automaton enters the goal cell**; the remaining instructions are not run or counted.
- The step limit is checked before each instruction: if the steps used have reached the limit and an instruction remains, the run fails with the step-limit outcome. A program that ends exactly at the limit without reaching the goal ends with “program ended”. Reaching the goal on the last allowed step succeeds.
- An unknown or malformed instruction stops the run (a content error, never silently skipped).
- A level whose **goal is the start cell** is invalid, because an empty program would solve it.

Never show a bare “Level failed,” a raw error code, or a stack trace. Level data that fails validation is a content error shown with a friendly load message, not a player failure.

### Separation

The simulation engine is separate from visual animation. Animations display simulation events; they never define game logic. The rules are testable without Godot's UI.

## 5. Difficulty progression and campaign structure

The campaign is a tree: **worlds** (one concept each), **chapters** (small groups within a world), and **levels**. Levels unlock sequentially along the flattened order (world, then chapter, then level). The stages below map onto worlds. Placement is campaign data managed in the dashboard, not part of a level's definition.

Teach concepts progressively rather than making early levels arbitrarily difficult. Each world teaches one idea, and from world 3 on each world needs a mechanic the game must implement first (section 3 and its subsections). The first two worlds need nothing new and are built first; the later worlds are a roadmap, designed one at a time as each is reached.

| #   | World      | Idea                                 | Algorithm the player uses                                                                            | Needs                                                                      | Levels |
| --- | ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| 1   | Basics     | Sequencing and turning               | Step-by-step execution: trace a program by hand and predict where it ends                            | nothing new                                                                | 8      |
| 2   | Routes     | Planning and budgets                 | Shortest-path search (turns cost too) and working backward from the goal                             | nothing new                                                                | 10     |
| 3   | Loops      | Repeating a pattern                  | Pattern detection (find the repeating unit); split a route into loops plus the moves between them    | `REPEAT n` (specified in 3.1; rules package built, no editor UI yet)       | 8-10   |
| 4   | Until      | One program for any distance         | Scan until a condition holds (linear search with a stop condition); reason about when a loop ends    | `REPEAT UNTIL` (blocked, or at the goal)                                   | 8-10   |
| 5   | Decisions  | Choosing by what you sense           | Wall-following (the right-hand rule) and a greedy local rule; decisions based on the current state   | `IF` sensors (wall ahead, goal ahead)                                      | 8-10   |
| 6   | Procedures | Naming and reusing steps             | Abstraction and decomposition: build big solutions from small named parts                            | named procedures                                                           | 8      |
| 7   | Generalize | One program, many boards             | Generalization and edge cases: the solution must work on every test board, including the tricky ones | multi-board levels (below)                                                 | 8      |
| 8   | Counters   | Remembering a number and changing it | Accumulation: a value that grows each round (spirals, widening stairs, count to n then act)          | one counter variable: set, add one, use as a loop count                    | 8      |
| 9   | Memory     | Marking where you have been          | Depth-first search with backtracking (the Tremaux idea): explore, mark, return, never repeat a path  | markers: `DROP MARK`, `IF MARK AHEAD` (the board changes during a run)     | 8      |
| 10  | Sweep      | Covering everything efficiently      | Systematic coverage (the lawnmower sweep) and efficiency: the same job in far fewer steps            | goal type "visit every floor cell"; step budgets that scale with the board | 8      |

Worlds 1 and 2 hold 18 levels, so a player meets the first algorithmic idea (loops) after about 18 short levels. The budget ideas ("the limit equals par") live in the last chapter of world 2.

**Decisions for the later worlds** (2026-10-19): the counter in world 8 is a single variable. World 9 may change the board during a run, so a run's state then includes the marks and the trace records them. "Visit every floor cell" is its own goal type, not a combination with reaching a tile. Recursion (a procedure that calls itself) and delivery puzzles (pick up and drop items) were considered and left for later.

**Multi-board levels (world 7 onward).** A level may carry several test boards, and one program must solve every one of them. The simulator is unchanged (it runs one board); the level, validator, and publish gates check the program against each board and name the first board that fails. With conditions and procedures, par is no longer an exact shortest-program search: it is the author's best known solution, verified on every test board. Bodies, counts, and the step limit stay bounded as in 3.1.

**Boundary.** This is a set of taught, puzzle-specific tools, never a general-purpose programming language (see the not-included list in [README_PROJECT_OVERVIEW.md](README_PROJECT_OVERVIEW.md)).

The game accepts any valid solution unless a level explicitly introduces an optimization challenge. Players must not feel that one particular sequence is required when several correct solutions exist.

## 6. Screen orientation

**Decision: portrait-first** for the initial mobile release. It concentrates design and testing effort on one layout.

### Portrait layout (top to bottom)

1. Top bar: back button, level title or number, settings.
2. Objective area: the goal, command budget, and relevant feedback.
3. Game board: centered and large enough to understand the layout.
4. Program area: ordered command slots, with the active command highlighted.
5. Command palette: available instructions.
6. Execution controls: Run, Step, Pause/Resume, and Reset.

On smaller screens the program area can scroll. Do not shrink the board so much that cells are hard to distinguish. Keep the primary Run button easy to reach, keep touch targets comfortable, and do not hide important information behind decoration. Visual details are in [README_VISUAL_DESIGN.md](README_VISUAL_DESIGN.md).

### Landscape later

Keep the UI responsive enough that landscape remains possible, but do not require a separate landscape layout for the MVP. A later landscape layout could place the board on the left and program controls on the right.

## 7. Progress: local-first, offline-first, cloud sync

**Decision:** progress is stored on the device first. Players can download the game, play, and complete levels with no account and no connection. When the player signs in and the device is online, progress syncs to the cloud.

### Local progress

Save on the device:

- Completed level IDs.
- Highest unlocked level (recomputed from completions and the current campaign order, so reordering never strands a player).
- Best solution metrics per level (fewest commands, fewest steps), when applicable.
- Last played level.
- Settings: sound, music, vibration, reduce motion, run speed, and theme (system, light, dark).

Use a versioned save format so updates can change the data structure without losing progress. Writes must be safe against interruption: if the app closes unexpectedly, previously saved progress stays intact.

Completion is keyed by stable level ID, so publishing a new version of a level does not erase a completion. Best metrics record the level version they were achieved on.

### Cloud sync

Accounts are optional and are never required to play. A signed-out player's progress is never uploaded.

When the player is signed in and online, the game syncs in the background:

- after signing in (an initial merge),
- when a level is completed,
- when the app starts, and
- when connectivity returns after a failed attempt.

Sync failures are silent to the player and retried with backoff. A sync failure, an expired session, or a sign-out never erases or blocks local progress.

### Merge policy

When local and cloud progress both exist, merge them; never blindly replace one with the other:

- Combine completed levels (union).
- Recalculate unlocks from completion data and progression rules.
- Keep the better result for metrics such as fewer commands or fewer steps.
- Use the most recently updated value for settings.
- Never delete local progress because authentication or synchronization failed.

The server merges and returns the result; the client then adopts the merged state. The merge is idempotent, so repeating a sync is safe.

### Trust

Progress and metrics sent by a client are not trusted for competition. Leaderboards, if introduced, need a defined scoring formula and server-side verification (for example, replaying the submitted program on the reference simulator) before any result is shown publicly.

### Delivery phasing

The data model, API shape, and save format are designed for sync from the start, so adding accounts later does not require migrating saves. The accounts and sync feature itself is built after the core loop and dashboard-managed publishing work end to end (see the implementation plan).

## 8. Offline support

The core game remains playable without a constant internet connection.

- Previously downloaded levels are cached locally, keyed by level ID and version.
- A small set of starter levels is bundled with the app so a first launch works offline.
- Local progress keeps saving offline.
- The game clearly indicates when fresh levels are unavailable, and distinguishes “not downloaded” from “locked by progression.”
- Network errors never block already-downloaded levels.
- A bad response never replaces a valid cached level.
- Account sync retries when connectivity returns.

## 9. Dashboard-based level publishing

New levels are content, not new game code.

The Next.js dashboard lets an authorized administrator create, edit, preview, and publish levels. The NestJS API validates and stores the definitions, and PostgreSQL persists them. The Godot game downloads published definitions and renders them with its existing engine.

### Publishing workflow

1. Create a level in the dashboard.
2. Define the board, starting state, goal, available commands, and command budget.
3. Preview and test it with the reference simulator, and record a reference solution.
4. Validate. The level must pass schema rules and be solved by its reference solution. The solver computes par (the shortest program) and flags a command budget below par.
5. Record a playtest. Publishing requires a solved playtest record for the current content.
6. Publish. Publishing is blocked if the level needs a mechanic the deployed app does not support.
7. Place the level in a chapter of a world; placement controls what players see and the unlock order.
8. The game fetches the updated campaign.
9. Players download and play the new level without an app rebuild.

### Versioning and compatibility

- Each level has a stable ID and a version.
- Editing a published level creates a new draft version; it never silently changes a version someone is already playing. Published versions are immutable.
- The game validates downloaded definitions and rejects incompatible data safely.
- Each level lists the mechanics it requires, and each game build declares what it supports. A client skips or flags levels it cannot play.
- New levels can be published without an app update only when they use mechanics the installed game already supports. A brand-new command or mechanic may require a client update.

## 10. MVP acceptance criteria

The first version is ready for broader testing when:

- Players can complete levels without creating an account.
- The command palette supports adding, deleting, and reordering instructions.
- Run, Step, Pause/Resume, and Reset behave consistently.
- The game detects success and failure correctly and explains failures.
- Identical programs produce identical outcomes, and the game, dashboard preview, and API agree on every shared fixture.
- Local progress survives app restarts and interrupted saves.
- Downloaded levels remain playable offline.
- An administrator can publish a new level from the dashboard without rebuilding the game.
- Invalid or unsolvable level definitions are rejected safely.
- The portrait layout works on small mobile screens.
- Core command and simulation rules have automated tests.

Optional accounts and cloud sync have their own acceptance criteria in the implementation plan.

## 11. Final decisions

For the first release, keep the scope focused:

- **Gameplay:** visual programming puzzles with movement, turns, and eventually loops.
- **Orientation:** portrait-first.
- **Progress:** local-first and offline-first, with optional accounts and cloud sync.
- **Backend:** publishes and delivers level content; later stores synced progress.
- **Dashboard:** authors and manages levels from day one.
- **Future expansion:** conditions, interactable objects, leaderboards, and more advanced algorithmic challenges.

The principle: build a small, genuinely enjoyable programming puzzle game first, but design its content and progress systems so new levels can be published, and progress synced, independently of app releases.
