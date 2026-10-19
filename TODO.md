# TODO

The plan and the reasons are in [docs/README_ROADMAP.md](docs/README_ROADMAP.md). Tick items as they are done. Detail grows as each step is reached.

## Now: step 1, worlds 1 and 2 (18 levels)

**Level lab** (`scripts/level-lab/`, see its README)

- [x] Candidate families for worlds 1 and 2: straight runs, turns, the U-turn, detours, tight budgets, decoy routes
- [x] Scoring from the real solver: par, moves, turns, wall cost, decoy cost, number of shortest programs, dead ends
- [x] Look-alike removal (rotations and mirrors) and a varied shortlist
- [x] Contact-sheet renders in the house style, light and dark (SVG; convert to PNG to view)
- [ ] A constrained maze generator (a unique cheap route and deliberate dead ends); today only random wall segments
- [ ] Rejection rules across a set: par equal to an earlier level, a limit that does not force a decision
- [ ] A better decoy builder: the random one finds few candidates and the decoy is small (1 to 2 commands)

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
- [ ] Check that saved progress for removed slugs is dropped gracefully (game and API merge)

**Verify**

- [ ] `make check` green (lint, typecheck, API and game tests pass; the full run is not yet repeated)
- [x] Game plays the new levels (screenshots checked: palette starts with Move only)
- [ ] Dashboard lists the new levels; `/levels` and `/play` show them
- [ ] Review all screenshots at 390x844, 360x640, 412x915 in both themes (captured by `make game-shots`; only 390x844 reviewed so far)

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
- [ ] In-game how-to-play teaches loops (only shown once a loop level exists)

**Dashboard and API**

- [x] Solution editor and preview support `REPEAT` (loop rows with a rounds field and a body; checked in a browser on a temporary page)
- [x] Publish gates: par from the loop solver (already), budget against par in slots, and a `LOOP_NOT_REQUIRED` warning when flat par fits the limit (`apps/api/test/loops.test.ts`)
- [x] Import and export of loop levels (the contract validator and the API pass loop nodes through; no change needed)
- [ ] Dashboard validation panel and diff texts mention loops (not yet checked in the live editor)
- [x] Client registry and the game both list the `repeat` mechanic (the seed's registry row and `Campaign.SUPPORTED_MECHANICS`)
- [ ] Bump the game version when loops ship in a release
- [ ] Web tests for the publish flow (Playwright or equivalent)
- [ ] How-to-play page and the browser build teach loops

## Then: step 3, world 3 (Loops)

- [ ] Pattern families: stairs, wide steps, run and climb, ridge, crossing, rooms
- [ ] Gate: flat par above the limit; loop par at or below the limit
- [ ] 8 to 10 levels chosen, titled, hinted, and playtested by real people
- [ ] Seed, bundle, and screenshots

## Later

- [ ] Step 4: verified submissions, points ledger, stars, result screen, player management (see [docs/README_SOCIAL_PLAN.md](docs/README_SOCIAL_PLAN.md))
- [ ] Step 5: world 4 (`REPEAT UNTIL`), world 5 (`IF` sensors)
- [ ] Step 6: leaderboards, daily challenge, sharing
- [ ] Step 7: worlds 6 to 10

## Open items

- [ ] Add the ten-world ladder and multi-board levels to the architecture doc's contract section when world 7 is designed
- [ ] Move the API's in-memory rate limiter to a shared store before running more than one instance
