# TODO

The plan and the reasons are in [docs/README_ROADMAP.md](docs/README_ROADMAP.md). Tick items as they are done. Detail grows as each step is reached.

## Now: step 1, worlds 1 and 2 (18 levels)

**Level lab** (a script outside the shipped code, `scripts/level-lab/`)

- [ ] Candidate families: straight runs, corners, the U-turn, detours with a decoy route, tight budgets
- [ ] A constrained maze generator (unique cheap route, dead ends, no accidental shortcuts)
- [ ] Scoring from the real solver: par, flat par, decoy cost, turns, number of near-optimal routes
- [ ] Rejection rules: shortcut found, par equals an earlier level, limit not forcing a decision
- [ ] Contact-sheet renders in the house style, light and dark

**Curriculum**

- [ ] One-line idea for each of the 18 levels (world 1: Basics, 8; world 2: Routes, 10), in order
- [ ] Shortlists per chapter (Moves, Turns, Detours, Budgets), reviewed with the owner
- [ ] Titles, progressive hints (1 to 3, no spoilers), difficulty from measured numbers
- [ ] Decide which of the current 19 levels, if any, are kept

**Seed and data**

- [ ] New seed data file replacing the 19 starters; the seed still validates and solves every level at startup
- [ ] Seed and campaign tests (every level solved, limits at or above par, unique slugs, order)
- [ ] Update the docs that say "nineteen" (`README_ARCHITECTURE.md`, `DEPLOY.md`)
- [ ] Reset the local database and reseed (`make db-reset`); reset Render's when deploying
- [ ] Regenerate the game's bundled levels (`scripts/bundle-levels.mjs`)
- [ ] Check that saved progress for removed slugs is dropped gracefully (game and API merge)

**Verify**

- [ ] `make check` green; game plays all 18 levels
- [ ] Dashboard lists the new levels; `/levels` and `/play` show them
- [ ] Screenshots at 390x844, 360x640, 412x915 in both themes

## Next: step 2, `REPEAT` in the editor and the dashboard

**Game**

- [ ] Tape model for nested groups: a loop group of a count tile and body tiles
- [ ] Repeat tile in the palette; append, remove, reorder, change the count
- [ ] Slot counter ("5 of 5") and the command limit counted in slots
- [ ] Run and step animation: the current body tile and "Round n of m"
- [ ] Failure messages name the body instruction and the round
- [ ] Result screen and local best use slots; progress and sync merge keep working
- [ ] GUT tests for the tape model and the play session with loops
- [ ] Update `README_VISUAL_DESIGN.md` for the loop group and the Repeat tile

**Dashboard and API**

- [ ] Solution editor and preview support `REPEAT`
- [ ] Publish gates: par from the loop solver, budget against par, flat par versus the limit for loop levels
- [ ] Import and export of loop levels; dashboard texts and the validation panel
- [ ] Client registry: add the `repeat` mechanic when the game supports it; bump the game version
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
