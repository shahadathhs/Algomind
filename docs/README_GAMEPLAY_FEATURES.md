# Algomind — Gameplay Features

> **Purpose:** Define the player-facing experience and separate MVP gameplay from later ideas.  
> **Design assumption:** Algomind is a deterministic, grid-based logic puzzle in which the player plans a small automaton's actions before running them. Confirm and adjust this core rule before implementation.

## 1. Core gameplay concept

Each level presents a compact board with a starting state and a goal. The player creates a short program using a limited set of available commands. When the player presses **Run**, the automaton executes those commands in order. The player studies the result, changes the program, and tries again until the goal is satisfied.

The challenge comes from planning, reading the board, and understanding how the available rules interact—not from fast reactions or hidden controls.

## 2. Core player loop

1. **Inspect:** Understand the board, the automaton's starting position and direction, obstacles, and goal.
2. **Plan:** Add supported commands to an instruction sequence.
3. **Simulate:** Run the sequence and watch the automaton move one step at a time.
4. **Learn:** Receive clear feedback about success or why the attempt failed.
5. **Adjust:** Edit the sequence, reset the run, or use a hint.
6. **Complete:** Save local progress and continue when the level is solved.

The player should be able to replay a level without friction. There are no lives, energy systems, or timers in the MVP.

## 3. MVP features

### 3.1 Level board

- Display the grid clearly at phone size.
- Distinguish empty tiles, walls/obstacles, the starting position, the goal, and any mechanics supported by that level.
- Make the current automaton position and orientation unambiguous.
- Scale the board to the available viewport without making cells or touch targets too small.
- Use color plus shape, icon, or animation to communicate state; do not rely on color alone.

### 3.2 Command/program editor

Start with the smallest command set that makes the core puzzle interesting. A reasonable first prototype is:

- `MOVE_FORWARD`
- `TURN_LEFT`
- `TURN_RIGHT`

Add a command such as `INTERACT` only if the initial puzzles need switches or interactable objects. Do not begin with loops, conditions, variables, sensors, or a general-purpose programming language unless those are central to the intended design.

Required behavior:

- Add commands using touch-friendly controls.
- Remove, reorder, and replace commands.
- Show the command limit when a level has one.
- Make the current sequence readable before execution.
- Provide **Run**, **Step**, **Pause/Resume**, and **Reset** as appropriate for the first version.
- Prevent the player from accidentally editing the sequence while a run is executing, or define and test a clear edit-during-run behavior.
- Preserve the current sequence when a run fails so the player can inspect it.

### 3.3 Deterministic simulation

- Commands execute in a defined order.
- Walls, board boundaries, and blocked movement follow consistent rules.
- Each run starts from the exact level-defined initial state.
- Reset restores the initial state and rewinds simulation feedback.
- The simulation has a maximum step/instruction budget to prevent accidental infinite runs.
- The simulation engine is independent from animation and UI code so it can be unit-tested.

The simulation must not depend on animation frame rate, network latency, or wall-clock time. Animations display simulation events; they do not define game logic.

### 3.4 Win and failure states

Each level defines its goal condition. For the initial version, reaching the goal tile is enough unless a specific level introduces another already-supported goal rule.

Possible result states:

- **Solved:** Goal condition reached.
- **Blocked:** A move is prevented by a wall or boundary, if that is a failure under the rules.
- **Program ended:** All commands executed without reaching the goal.
- **Instruction budget reached:** The safety limit was hit.
- **Invalid level:** Level data failed validation; this is a content/runtime error, not a player failure.

For a failure, give a concise explanation and offer **Try Again**. Never expose raw API errors or stack traces to players.

### 3.5 Level selection and progression

- Show level number/name, completion status, and optional difficulty label.
- Start with a small, curated campaign rather than a huge catalog.
- Unlock levels sequentially by default; the progression rule should be simple and consistent.
- Allow completed levels to be replayed.
- Store completion and best result locally in the MVP.
- When a newer published version changes a level, preserve progress safely; do not silently reinterpret a stored score against a different level version.

### 3.6 Hints and onboarding

- Teach the controls interactively in the first few levels.
- Introduce one new concept at a time.
- Give optional hints in plain language, stored as level data.
- A hint should point the player toward the relevant idea rather than automatically solve the puzzle.
- Hints are optional and never required to make the game playable.

### 3.7 Audio, motion, and feedback

- Provide a sound toggle and respect device mute settings.
- Use subtle audio/visual feedback for command placement, movement, blocked actions, and puzzle completion.
- Provide reduced-motion behavior or a setting to minimize animation.
- Never make sound necessary to understand whether an action succeeded.

### 3.8 Remote level content

The game should:

- Fetch the published level catalog from the API.
- Fetch a level's published version when the player opens it, or use a cached copy.
- Cache successful responses and include schema/version metadata.
- Display loading, retry, offline, and empty states.
- Validate critical fields before trying to build a board from remote data.
- Avoid replacing a valid cached level with an invalid response.
- Never download or execute arbitrary scripts as level content.

If the service is unavailable, previously downloaded and bundled levels should remain playable. Newly published levels naturally require a successful fetch at least once.

## 4. Level content model

Each level should be described by data, not a special scene or hardcoded `if level_id == ...` branch.

Minimum fields:

- `id`: stable identifier.
- `slug`: human-readable stable URL/key.
- `title` and `description`.
- `schemaVersion`: version of the level-data contract.
- `levelVersion`: version of the published content.
- `difficulty` and `sortOrder`.
- `board`: width, height, and cell/entity data.
- `initialState`: starting position and orientation.
- `availableCommands`: commands the player may use.
- `constraints`: optional command or step limits.
- `goal`: structured goal definition.
- `hints`: optional ordered hint text.

Detailed shape and API rules are specified in `README_ARCHITECTURE.md`. Levels are authored in the admin dashboard; its controls are based on supported fields, and validation must happen on both the server and the game client. Authoring content also carries a reference solution (never sent to players) and a `requires.mechanics` list so a client can tell whether it can play a level.

## 5. Scoring

### MVP recommendation

Use a simple completion result first. Record whether the level was solved and which published level version was played. Avoid designing a complex rating system before playtesting the core game.

### Possible later scoring

- A medal or star for completion.
- Optional bonus for staying under a command budget.
- Optional bonus for using fewer steps.

If score rankings are later introduced, define the scoring formula explicitly and version it. Do not compare results across incompatible level versions without a clear policy.

## 6. Future features — only after the core game works

Potential additions, in priority order:

1. More board mechanics (for example, switches, doors, pushable objects, or conveyors) after each mechanic is implemented and tested in the engine.
2. More nuanced goals, such as collecting an item before reaching the exit.
3. Cloud progress and account linking.
4. Leaderboards for a clearly defined challenge mode.
5. Daily or weekly puzzles.
6. Community levels, moderation, and sharing.

Each new mechanic should include a rule definition, visual representation, tutorial/teaching plan, deterministic simulation behavior, unit tests, and compatibility decision. A dashboard toggle alone cannot safely introduce a mechanic the client does not understand.

## 7. Explicit non-goals for MVP

- Multiplayer or player-versus-player features.
- Ads, in-app purchases, subscriptions, or an economy.
- Player-generated content marketplace.
- Cloud-synced save states required to play.
- Procedural generation as a substitute for curated puzzle design.
- Open-ended scripting or downloading executable game logic.

## 8. Gameplay acceptance checklist

- [ ] A new player can understand movement and the goal from the first levels.
- [ ] Every run begins from the same initial state.
- [ ] Commands can be added, removed, and reordered reliably on touch screens.
- [ ] Run, step, pause/resume, reset, success, and failure states work predictably.
- [ ] A level can be represented entirely as data.
- [ ] The client can load a valid bundled level and a valid remote level.
- [ ] Invalid remote data fails safely and does not crash the game.
- [ ] Previously downloaded levels remain available during a temporary network outage.
- [ ] Level completion and progression survive app restart.
- [ ] Every shipped level has been solved in playtesting and has clear instructions/hints where needed.
