# CI/CD, tooling, and releases

> **Status: planned.** Nothing here has been implemented or run yet. It follows the conventions of the DropGrid project. Update this file in the same change as any workflow or tooling change so it always matches the code.

## Principles

- **One command surface.** The `Makefile` is how you run everything locally. CI runs the same commands, so "passes locally" means "passes in CI".
- **Gates before deploys.** Pull requests and every push run the quality gates. Only `main` continues into deploy and release jobs.
- **Fail closed.** A deploy job fails the run if the deployment does not go live. Missing optional secrets produce a visible warning, never a silent skip of something critical.
- **Pinned and reproducible.** Lockfiles are frozen in CI (`pnpm install --frozen-lockfile`), tool versions are pinned, and Dependabot keeps actions and dependencies current.

## Local tooling

| Tool | Purpose |
|---|---|
| Husky | Git hooks (`pre-commit`, `commit-msg`) |
| lint-staged | Lint and format staged files only |
| commitlint | Enforce Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `wip`, `release`) |
| commitizen + cz-git | Guided commits (`pnpm commit`) |
| prettier | Formatting for TypeScript, JSON, Markdown, YAML |
| oxlint (type-aware) | TypeScript linting for every TypeScript app and package. There is no ESLint: TypeScript 7 has no JS compiler API, so typescript-eslint cannot parse it. |
| tsc | Type checking in each TypeScript app and package |
| Jest / Playwright | API unit and e2e tests; web smoke tests |
| gdlint + gdformat (gdtoolkit, pinned) | GDScript style gate |
| GUT | Game unit tests, run headless in Docker |
| Prisma | Schema validation and migrations |

Hooks live at the repository root and cover the whole repo. Typical `make` targets:

```sh
make lint            # all linters and format checks
make typecheck       # tsc across TypeScript apps/packages
make test            # contract, api, web, and game tests
make game-check      # load the Godot project headless
make api-run         # run the API locally (needs make db-up)
make web-dev         # run the web app
make apk             # export a debug Android build
make release v=0.2.0 # bump VERSION, commit, push
```

## Branching and commits

Work on `dev`, open a pull request into `main`, keep `dev` fast-forwarded to `main` after each merge. Commits follow Conventional Commits and are validated by the `commit-msg` hook.

## Pipeline

One workflow, `.github/workflows/ci.yml`, with `concurrency` per ref, least-privilege `permissions`, and current pinned action versions.

| Job | Runs for | What it does |
|---|---|---|
| `tokens` | every push and PR | Regenerate the Godot palette and web CSS from `packages/design-tokens`; fail if the generated files differ from the committed ones; fail if a hand-defined color appears outside them |
| `contract` | every push and PR | Lint, typecheck, and test `packages/level-contract` (all fixtures) |
| `api` | every push and PR | Lint, typecheck, Prisma validate, migrate a PostgreSQL service container, unit and e2e tests, build |
| `web` | every push and PR | Lint, typecheck, tests, `next build` |
| `game` | every push and PR | `gdlint`, `gdformat --check`, headless project load, GUT tests (including every contract fixture) |
| `deploy-api` | `main` | Triggers the Render deploy hook, then polls the Render API until live; fails the run on a failed or timed-out deploy |
| `apk` | `main`, `v*` tags | Injects version and API URL, builds the Android package, uploads the artifact |
| `web-export` | after launch, when browser play is added | Builds the game's web export; PRs prove it still builds |
| `release` | `main` | Refreshes the rolling **Latest build**, triggers the Vercel rebuild hook, and publishes a versioned release when `VERSION` names a version without a release |

A normal push to `main`: gates, API deploy, Android and web exports, rolling Latest build, web rebuild. A version bump does all of that plus the versioned release.

## Releases

```sh
make release v=0.2.0   # writes VERSION, updates export presets, commits, pushes
```

When that reaches `main`, the pipeline publishes **Algomind v0.2.0** with the Android build, marked as the latest release. Rolling builds never take the "latest" flag. Releases are idempotent: a version is published once.

## Secrets and variables

| Name | Kind | Used by |
|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | secret | `deploy-api` |
| `RENDER_API_KEY` | secret | `deploy-api` (waits for the deploy to be live) |
| `VERCEL_DEPLOY_HOOK` | secret | `release` (rebuild the public site so the download page shows the new release; later also the web export) |
| `ANDROID_DEBUG_KEYSTORE_BASE64` | secret | `apk` (fixed signing key so builds install over each other) |
| `API_BASE_URL` | variable | `apk` (must be `https://…/v1`; the build fails otherwise) |

Secrets are never committed. A Google Play release needs a separate upload keystore and an `.aab`; that is outside the initial MVP.

## Dependency updates

Dependabot runs weekly for GitHub Actions and the pnpm workspace. Group action bumps into one pull request.

## Known limits to revisit

- Each run may rebuild the Godot Docker image; add caching if it becomes slow.
- The Render deploy hook deploys the service's latest state; it does not pin a commit.
- The first deployment must verify these workflows; until then treat this document as the design, not a record.
