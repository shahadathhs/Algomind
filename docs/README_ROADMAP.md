# Algomind — Roadmap

> **Purpose:** The order of work from here to a complete game, with what each step delivers and when it is done. The day-to-day checklist is [../TODO.md](../TODO.md).  
> **Status:** agreed 2026-10-19. Steps 1 to 3 are planned in detail; later steps are outlined and are detailed when reached.  
> **Related:** rules and the world ladder in [README_GAME_RULES.md](README_GAME_RULES.md); points, leaderboards, daily challenge, and sharing in [README_SOCIAL_PLAN.md](README_SOCIAL_PLAN.md); the dashboard in [README_DASHBOARD_PLAN.md](README_DASHBOARD_PLAN.md).

## 1. Principle

**Levels first, then the feature a later world needs, then that world's levels.** Worlds 1 and 2 need no new mechanic, so they come first. Every later world needs a mechanic that does not exist yet, so its levels wait for it. Quality over count: a level joins the campaign only if it teaches one new idea and passes the quality bar in section 4.

The game is called Algomind, so the campaign must teach algorithms, not only paths. From world 3 on, each world is built around one algorithmic idea (see the ladder in [README_GAME_RULES.md](README_GAME_RULES.md), section 5).

## 2. Where things stand

**Done**

- Public site, the `/play` browser build (always offline-only), the download page, and the level catalog.
- Player accounts, progress sync, and the sign-in screens.
- `REPEAT` in the rules package: contract, validator, simulator, loop-aware solver, fixtures, and the GDScript simulator and validator, all passing the same fixtures (PR #10 on `dev`).
- Plans: the world ladder ([README_GAME_RULES.md](README_GAME_RULES.md)) and the social plan ([README_SOCIAL_PLAN.md](README_SOCIAL_PLAN.md)).

**Not done**

- The game's editor cannot build loops yet; the tape, palette, and counters treat a program as a flat list.
- The dashboard and the publish gates do not know loops yet.
- The 19 starter levels are basic. The campaign is not yet a designed curriculum.
- The web app has no automated tests.

## 3. Steps

| Step | Delivers                                                                                                         | Needs                           | Done when                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Worlds 1 and 2: 18 curated levels, a level lab, a clean database reset and reseed, and a regenerated game bundle | nothing new                     | The seed validates and solves every level; the game plays them; the dashboard lists them; both themes and all three sizes checked |
| 2    | `REPEAT` in the game's editor and in the dashboard and publish gates                                             | nothing (independent of step 1) | A player can build, run, and fail and fix a loop on a phone; the dashboard can author, preview, and publish a loop level          |
| 3    | World 3, Loops: 8 to 10 levels                                                                                   | step 2                          | Every level requires a loop (flat par above the limit); bundled; playtested by real people                                        |
| 4    | Points, verified submissions, and player management (phases 1 and 2 of the social plan)                          | step 3                          | A solved level awards points from a verified program; the dashboard manages players                                               |
| 5    | World 4 (`REPEAT UNTIL`), then world 5 (`IF` sensors), one mechanic and one set of levels at a time              | step 3                          | As for step 3, per world                                                                                                          |
| 6    | Leaderboards, daily challenge, and sharing (phases 3 to 5 of the social plan)                                    | steps 4 and 5                   | As defined in the social plan                                                                                                     |
| 7    | Worlds 6 to 10 (procedures, generalize, counters, memory, sweep)                                                 | step 5                          | Each designed in detail when reached, based on how players do with the earlier worlds                                             |

Steps 4 and 6 can move earlier if you want players to earn points sooner, but not before step 3: there is nothing interesting to score before the first loop.

## 4. The quality bar for every level

1. It teaches one idea the previous level did not.
2. No accidental shortcuts: the solver shows the intended route is the only cheap one. On open boards the solver is the judge of par, never the author's eye.
3. The command limit sits where it forces a decision: at par, or between par and the obvious route. In a loop world, flat par is above the limit, so a loop is required.
4. Difficulty comes from measured numbers (par, decoy cost, flat-versus-loop ratio), not guesses.
5. Hints are progressive and never give the solution away. Each level has a title and a recorded solved playtest.
6. The seed validates and solves it at startup, and fails loudly otherwise.

## 5. Rules for all steps

- The shared contract and its fixtures are the source of truth; a rule change changes the TypeScript and GDScript implementations together.
- Docs change in the same change as the code. `make check` is green before a step is called done.
- UI work is checked in screenshots at 390x844, 360x640, and 412x915 in both themes, and the web with JavaScript disabled, before it is called done.
- Nothing is committed or pushed until asked.
- The database may be reset until the first public release; after that, published versions are immutable and the seed only adds.

## 6. Risks

- **Content is the bottleneck.** The level lab and solver speed it up, but each level still needs a human eye. Keep the count small and the quality high.
- **Each mechanic is a full change:** contract, both simulators, fixtures, editor UI, and the version gate. Do one at a time.
- **The web app has no tests** and is the only way to create levels. Add tests for the publish flow before the dashboard grows (step 2).
- **Scope.** The social plan is large. Build phases 1 and 2 first and check that people play before building more.
