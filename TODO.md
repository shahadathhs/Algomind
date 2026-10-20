# TODO

The plan and the reasons are in [docs/README_ROADMAP.md](docs/README_ROADMAP.md). Tick items as they are done. Detail grows as each step is reached.

## Now: step 1, worlds 1 and 2 (18 levels)

**Level lab** (`scripts/level-lab/`, see its README)

- [x] Candidate families for worlds 1 and 2: straight runs, turns, the U-turn, detours, tight budgets, decoy routes
- [x] Scoring from the real solver: par, moves, turns, wall cost, decoy cost, number of shortest programs, dead ends
- [x] Look-alike removal (rotations and mirrors) and a varied shortlist
- [x] Contact-sheet renders in the house style, light and dark (SVG; convert to PNG to view)
- [x] A constrained maze generator (a unique cheap route and deliberate dead ends); today only random wall segments (`carve.mjs`: `maze`, family `budget-tree-maze`)
- [x] Rejection rules across a set: par equal to an earlier level, a limit that does not force a decision (`check`: equal par in a chapter, a loop that is optional, slack on a budget level)
- [x] A better decoy builder: the random one finds few candidates and the decoy is small (1 to 2 commands) (`carve.mjs`: `decoy`, family `budget-carved-decoy`; 164 candidates on seed 1 against 22)

**Curriculum**

- [x] One-line idea for each of the 18 levels (world 1: Basics, 8; world 2: Routes, 10), in order
- [x] Shortlists per chapter (Moves, Turns, Detours, Budgets); picked by the assistant on the owner's instruction ("just get it done")
- [x] Titles, progressive hints (1 to 3, no spoilers), difficulty from measured numbers
- [x] Decide which of the current 19 levels, if any, are kept (none: all replaced)

**Seed and data**

- [x] New seed data file (`starter-campaign.data.ts`) replacing the 19 starters; the seed still validates and solves every level at startup
- [x] Seed and campaign tests (`apps/api/test/starter-campaign.test.ts`)
- [x] Update the docs that say "nineteen" (`README_ARCHITECTURE.md`, `DEPLOY.md`)
- [x] Reset the local database and reseed (`make db-reset`)
- [ ] Reset Render's database when deploying
- [x] Regenerate the game's bundled levels (`scripts/bundle-levels.mjs`)
- [x] Saved progress for removed slugs is kept and ignored, never crashes (game test `test_progress_for_a_removed_level_is_kept_and_ignored`; the API merge stores any slug)

**Verify**

- [x] `make check` green (lint, typecheck, API and game tests pass; the full run is not yet repeated) (green on `dev` after the refactor)
- [x] Game plays the new levels (screenshots checked; every level offers Move, Left and Right from the start, by the owner's call: a new player can handle three tiles)
- [x] `/levels` and the home page show the new levels (both render per request now; the home drawings are computed from a real level and guarded by a test)
- [ ] Dashboard lists the new levels; `/play` shows them
- [x] Screenshots reviewed at 360x640 and 412x915 (play ready, running, failed, solved, big board; pause; worlds; world; home; settings; account; how-to-play): the pause scrim is now opaque. Not every one of the 102 was looked at by eye; the rest were checked identical before and after the `play.gd` split

## Next: step 2, `REPEAT` in the editor and the dashboard

**Game**

- [x] Tape model for loop groups: a count tile and body tiles (`tape_model.gd`)
- [x] Repeat tile in the palette; append, remove, reorder, change the count (minus and plus tools)
- [x] Slot counter ("5 / 5") and the command limit counted in slots
- [x] Run and step animation: the current body tile and the round on the count tile ("2/6")
- [x] A failure inside a loop puts the X on the body tile and shows the round on the count tile
- [x] Result screen and local best use slots (sync merge unchanged: it stores the command count)
- [x] GUT tests for the tape model and the play session with loops (`test_tape_loops.gd`)
- [x] Update `README_VISUAL_DESIGN.md` for the loop group and the Repeat tile
- [x] In-game how-to-play teaches loops (a Repeat row and a Loops paragraph; checked at 390x844 and 360x640, both themes)

**Dashboard and API**

- [x] Solution editor and preview support `REPEAT` (loop rows with a rounds field and a body; checked in a browser on a temporary page)
- [x] Publish gates: par from the loop solver (already), budget against par in slots, and a `LOOP_NOT_REQUIRED` warning when flat par fits the limit (`apps/api/test/loops.test.ts`)
- [x] Import and export of loop levels (the contract validator and the API pass loop nodes through; no change needed)
- [x] Dashboard validation panel and diff texts mention loops (checked in the live editor; the publish review diff gained a Solution row with slots and loops)
- [x] Client registry and the game both list the `repeat` mechanic (the seed's registry row and `Campaign.SUPPORTED_MECHANICS`)
- [x] Bump the game version when loops ship in a release (0.1.0; the release itself is the owner's call)
- [x] Web test for the publish flow (`make web-smoke`: Playwright driving Chrome; local, needs a running API and web app, not in CI)
- [x] How-to-play page and the browser build teach loops (the browser build uses the game screen)

## Then: step 3, world 3 (Loops)

- [x] Pattern families: stairs, wide steps, run and climb, ridge, crossing, rooms
- [x] Gate: flat par above the limit; loop par at or below the limit (`starter-campaign.test.ts`: every Loops level needs a loop)
- [ ] 8 to 10 levels chosen, titled, hinted, and playtested by real people
- [x] Seed, bundle, and screenshots

## Later

- [x] Step 4: verified submissions, points ledger, stars, result screen, player management (see [docs/README_SOCIAL_PLAN.md](docs/README_SOCIAL_PLAN.md), section 6 for what is built and what is not)
- [x] Step 5a: world 4, Until (`REPEAT_UNTIL`): contract, both simulators, solver, fixtures, dashboard and game editors, 8 levels in 2 chapters (see [docs/README_GAME_RULES.md](docs/README_GAME_RULES.md), section 3.2). Open: look at the new tile and header on screen at all three sizes in both themes, and playtest the 8 levels with real people
- [ ] Step 5b: world 5 (`IF` sensors)
- [x] Step 6: leaderboards, daily challenge, sharing, badges, level statistics, profile, stars on tiles (see [docs/README_SOCIAL_PLAN.md](docs/README_SOCIAL_PLAN.md), section 6). Open: look at the new game screens at all three sizes in both themes (a screenshot run needs a window; only 360x640 was reviewed), try the tap flows in the running game (report confirm, MORE paging, COPIED, clipboard), and test the browser build hides the four screens
- [ ] Step 7: worlds 6 to 10

## Open items

- [ ] Add the ten-world ladder and multi-board levels to the architecture doc's contract section when world 7 is designed
- [ ] Move the API's in-memory rate limiter to a shared store before running more than one instance
