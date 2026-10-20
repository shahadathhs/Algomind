# Algomind — Admin Dashboard Plan

> **Purpose:** Plan the admin dashboard (the `(admin)` route group of `apps/web`): the only place levels, worlds, and chapters are created, validated, playtested, published, and ordered.  
> **Reference renders:** [design/dashboard/](design/dashboard/) shows five key screens in light and dark. Names and numbers in them are placeholders.  
> **Status:** the API side of every phase below exists (levels, validation and solver, publishing gates, playtests, version history and restore, campaign structure, import and export, capabilities registry, audit log; see [README_ARCHITECTURE.md](README_ARCHITECTURE.md), section 7.1 for the exact routes and shapes). The dashboard screens built so far: shell, sign-in and session handling (phase 1); the level list with search, filters, sort and paging, create, duplicate and delete (phase 2); the level editor with details, board, commands and limits, solution tape, preview with the shared simulator, playtest records, checks and a confirmed publish, with explicit save, conflict handling and a local backup of unsaved edits (phases 2 to 4); version history with export and restore as draft; campaign (worlds, chapters, ordering, unassigned); import; capabilities registry; audit log. Not built yet: the dedicated publish review page with a visual and field diff against the live version, a diff between versions, unpublish and archive controls, level thumbnails in the list, home counts, and the quality pass (see section 12). The API has focused tests for the publish gates and authorization; the web app has no automated tests for now, and its screens were checked by hand against a real API and a headless browser.

## 1. Goals and constraints

- **Single admin.** One admin account, created automatically on API startup (section 8). Roles and multiple editors are a later extension; the `User.role` field already allows it.
- **Safe publishing.** A level reaches players only through a gated publish: it validates, its reference solution solves it, the solver confirms par, it has been playtested, and the deployed app can play it.
- **Content is data.** The dashboard edits level definitions defined by the shared contract; it never edits code.
- **Same renderer as the game.** The board, tape, and preview use the shared tile renderer and reference simulator so what the author sees is what players get.
- **Desktop first**, usable on tablet. Not a general-purpose CMS.

## 2. Campaign structure: worlds, chapters, levels

The campaign is a tree: **World → Chapter → Level**.

- A **world** teaches one concept (for example Basics, Routes, Loops; see the ladder in README_GAME_RULES.md). It has a title, a short description, and an order.
- A **chapter** is a small group of levels inside a world, with a title and an order.
- A **level** belongs to at most one chapter and has an order inside it. A level with no chapter is unassigned and never reaches players.
- **Unlocking** is sequential across the flattened campaign order (world order, then chapter order, then level order). Moving a level changes the campaign only; it does not create a new level version.
- The public catalog is served as this tree. Placement lives outside level versions, so reordering never forces a republish.

## 3. Features (MVP)

| Area                      | Feature                                                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session**               | Email and password sign-in; short-lived bearer access token with rotating refresh token; automatic logout on expiry, refresh failure, or inactivity, with a visible session countdown; change password.                            |
| **Home**                  | Counts (draft, published, archived), last publish, API health, latest app release.                                                                                                                                                 |
| **Level list**            | Table with thumbnail, title and slug, placement, status, difficulty, playtest state, updated time. Search, filter (all, draft, published, archived), world filter, sort. A published level with newer edits shows **Draft ahead**. |
| **Level editor**          | Tabs: Details, Board, Commands and limits, Solution, Hints, Preview, Playtest. Board editor with wall, floor, start, and goal tools; size, start and facing, goal. Allowed commands, max commands, max steps. Hints.               |
| **Reference solution**    | Authored on the same tape editor as the game.                                                                                                                                                                                      |
| **Preview**               | Runs the shared reference simulator with Run, Step, and Reset; the author can also try their own program.                                                                                                                          |
| **Solver**                | Computes the true shortest program (par) for the initial command set (section 5). Shown in validation, stored with the version, and used as the "best" result in the game.                                                         |
| **Validation panel**      | Errors and warnings linked to their fields: schema, ranges, goal reachable, reference solution solves it, par, budget versus par, mechanics required.                                                                              |
| **Save safety**           | Explicit Save draft (never publishes); local autosave backup; unsaved-changes warning; optimistic concurrency so two tabs cannot silently overwrite each other.                                                                    |
| **Playtest gate**         | Required before publish (section 6).                                                                                                                                                                                               |
| **Publish**               | A review page: checks, a visual and field-by-field diff against the live version, and a confirmation. Publishing creates an immutable version.                                                                                     |
| **Unpublish and archive** | With confirmation and an honest note that downloaded copies stay on devices.                                                                                                                                                       |
| **Version history**       | Versions list, visual board diff, field-by-field diff, discard draft, and restore any earlier version as a new draft.                                                                                                              |
| **Campaign structure**    | Create, rename, and reorder worlds and chapters; assign and reorder levels; an "unassigned" list.                                                                                                                                  |
| **Client compatibility**  | A registry of which mechanics each released app version supports; publishing is blocked if a level needs something the deployed client cannot do (section 7).                                                                      |
| **Duplicate level**       | Clone as a starting point.                                                                                                                                                                                                         |
| **Import and export**     | Export a level (draft or version) as validated JSON; import a JSON file into a new draft after full validation (section 9).                                                                                                        |
| **Audit log**             | Who published, unpublished, archived, reordered, imported, or restored what, and when.                                                                                                                                             |
| **Settings**              | Account, session information, API status.                                                                                                                                                                                          |

## 4. Screens

| Screen       | Contents                                                   |
| ------------ | ---------------------------------------------------------- |
| Sign in      | Email, password, error states; no sign-up                  |
| Home         | Counts, recent activity, release and API status            |
| Levels       | List and filters (rendered)                                |
| Level editor | Tabs listed above (Board tab rendered)                     |
| Publish      | Gate checks, diff, confirm (rendered)                      |
| History      | Version list and diff (rendered)                           |
| Campaign     | Worlds, chapters, order, unassigned (rendered)             |
| Capabilities | Registry of app versions and the mechanics they support    |
| Import       | File picker, validation result, import into a new draft    |
| Audit log    | Chronological list, filter by action                       |
| Settings     | Account and session                                        |
| Reports      | Open name reports; dismiss, clear name, hide from boards   |
| Daily        | Next 30 days, schedule or clear a day, the daily pool      |
| Badges       | Badge rules in words, earned-by counts, create and edit    |
| Statistics   | Per-level results from verified runs, by world and chapter |

### Social screens

Built on the social admin API (`/admin/reports`, `/admin/daily`, `/admin/achievements`, `/admin/level-stats`, and `PUT /admin/players/:id/leaderboard-hidden`). Each action asks for confirmation where it changes what players see and shows a result notice.

- **Reports** (`/admin/reports`): open reports (or all) with the reported name, the reason and a link to the player. Dismiss closes the report; Clear name removes the name and takes the player off the boards until they opt in again; Hide from boards sets the admin hide.
- **Daily** (`/admin/daily`): thirty UTC days with the level, difficulty, par and limit, and a Scheduled or Rotation label. Change picks a level from the pool; Clear returns the day to rotation (the pool is shuffled into a fixed order and every level comes once before any repeat). A pool panel lists published levels with Add to pool or Remove from pool; a campaign level cannot join the pool.
- **Badges** (`/admin/achievements`): each rule in words, the earned-by count, an active switch, and create and edit forms (a rule type with a number, or a level slug). A badge already earned stays earned; an off badge is hidden and not awarded.
- **Statistics** (`/admin/level-stats`): solvers, average slots, par, limit, at par, within two slots, and the change in solvers against the previous campaign level (a fall of 40% or more from a level with at least 5 solvers is marked a sharp drop), grouped by world and chapter, pool levels last. Numbers come from verified results only; failed runs are never recorded.
- **Players detail** also shows the leaderboard state (opted in, shown as Anonymous, hidden by an admin) with Hide from boards or Show on boards. The Players list does not show it, because the list API does not return those fields.

## 5. Solver

- **Scope (MVP):** the three initial commands. The state is the cell and facing direction, so the shortest solution is a shortest-path search over a few hundred states, computed instantly.
- **Output:** minimum commands (par) and the steps used by one shortest program; whether the goal is reachable at all.
- **Where it runs:** in `packages/level-contract`, used by the dashboard (live feedback) and by the API at validate and publish time. The result is stored on the version as `par` and served to the app for the "best" display.
- **Warnings it enables:** max commands below par (an error: unsolvable under the budget); max commands far above par (a warning); an author's reference solution longer than par (an informational note).
- **Tie-breaking (so every implementation finds the same program, not only the same length):** a first-in-first-out breadth-first search that tries `MOVE_FORWARD`, then `TURN_LEFT`, then `TURN_RIGHT`, and stops at the first discovered state whose cell is the goal.
- **Constraint check:** `fitsConstraints` is `commands <= maxCommands && steps <= maxSteps`; the search itself ignores both. “Max commands below par” is detected from it.
- **Later:** when `REPEAT` or conditionals arrive, a program-space search replaces it; until then par is only defined for the initial command set.

## 6. Playtest gate

- A **playtest record** holds: tester name, date, whether they solved it, commands used, perceived difficulty, and notes.
- Each record is tied to a **content hash** of the level definition. Any edit that changes the hash makes earlier records stale; Publish requires at least one **solved** record for the current hash.
- With a single admin the gate is honor-system (the admin enters the tester's name), but it leaves a traceable record and prevents publishing an untested edit.
- The Publish page shows the record count and the most recent entry; the level list shows playtest state per level.

## 7. Client compatibility

- The capabilities registry lists released app versions and the mechanics each supports (`move`, `turn`, later `repeat`, and so on; lowercase, the same pattern as `requires.mechanics`. A level needs the mechanics of its available commands plus any listed in `requires.mechanics`), plus the minimum supported version.
- Each level computes the mechanics it requires from its definition.
- Publish is blocked if a required mechanic is not supported by the minimum supported version. The page explains which mechanic and which versions lack it.
- A level that needs a newer app can still be published once the minimum version is raised; players on older apps see the "update required" screen.

## 8. Authentication and the seeded admin

- Bearer access token (about 15 minutes) with rotating refresh token (about 7 days); automatic logout; access token in memory and refresh token out of JavaScript-readable storage (see the architecture doc).
- **Auto-seeded admin:** on API startup, if no `ADMIN` user exists, create one from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASS`. The seed is idempotent, hashes the password, and never logs it. In production the API refuses to start if the variables are missing or weak while no admin exists. The first sign-in forces a password change.
- No public sign-up creates admins.

## 9. Import and export format

- Export wraps a level in an envelope: `{ format: "algomind-level", schemaVersion, exportedAt, meta: { title, slug }, level, referenceSolution }` (`level` is the contract level; `meta` is informational and the level's own fields win). It never includes placement, playtest records, or user data.
- Import validates the envelope and the level against the current schema and rules, shows field-level errors, and on success creates a **new draft** (never overwrites an existing level or version). A slug conflict asks for a new slug.
- Unsupported `schemaVersion` is rejected with a clear message.

## 10. Quality requirements

- Keyboard navigation everywhere, with visible focus; accessible names for all controls.
- Visible save status (Unsaved, Saving, Saved, Save failed) and a warning before discarding edits.
- Loading, empty, error, forbidden, and conflict states for every screen.
- Session expiry never loses work: unsaved draft edits are kept locally and offered back after sign-in.
- All server rules are enforced by the API; the dashboard only mirrors them for usability.
- Both themes pass contrast; draft is an outlined tile and published is a solid tile throughout.
- No dashboard action calls a game or public-only route in a way that bypasses authorization.

## 11. Non-goals

Anything that runs scripts, real-time collaboration, public submissions, per-level analytics (the product does not track players), rich-text editing, and multi-admin roles at launch.

## 12. Implementation phases (dashboard)

1. **Foundation:** admin shell, sign-in and session handling, token refresh and auto-logout, route protection, theme tokens.
2. **Levels:** list and filters, create and duplicate, editor tabs (details, board, commands and limits, hints), save safety and concurrency.
3. **Solution, preview, solver, validation:** tape editor, preview with the reference simulator, solver, validation panel.
4. **Publishing:** playtest records, client compatibility, publish review page with diff, unpublish and archive, version history and restore.
5. **Campaign:** worlds, chapters, ordering, unassigned list.
6. **Operations:** import and export, capabilities registry, audit log, settings, home.
7. **Quality pass:** accessibility, keyboard flows, error and conflict states, both themes, tests (including publish gates and authorization).

### Exit criteria

- An admin can create a level, solve it with the tape editor, see par from the solver, record a playtest, publish it, place it in a chapter, and see it in the public catalog, without touching JSON or code.
- Publishing is impossible when validation fails, the solver says the budget is below par, there is no current playtest, or the level needs an unsupported mechanic; each case explains why.
- Reordering and restoring work without corrupting published versions.
- A session can expire mid-edit without losing work.
- The dashboard passes the visual checklist in both themes.

## 13. Open items

- The exact fields of a playtest record and whether a minimum number of records is required.
- How the capabilities registry is populated: manually by the admin, or from release metadata.
- Whether worlds and chapters need cover art or only text at launch (text only is assumed).
- Whether import should accept a batch of levels, or one at a time (one at a time is assumed).
