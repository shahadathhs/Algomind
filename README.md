# Algomind

**A programming puzzle for Android.** Build a program from instruction tiles, run it, and guide the automaton to the target. Offline first. No ads. No purchases.

> **Status:** early development. The specification is in [docs/](docs/); the code is being built phase by phase (see the [implementation plan](docs/README_IMPLEMENTATION_PLAN.md)). Nothing here is released yet.

## Repository

```text
apps/
  game/            Godot project (Android first)          [planned]
  api/             NestJS API, Prisma, PostgreSQL         [planned]
  web/             Next.js: public site + admin dashboard [planned]
packages/
  design-tokens/   Theme tokens and generators (Godot palette, web CSS)
  level-contract/  Schema, validator, reference simulator, solver, fixtures [planned]
docs/              Specification, design renders, CI and deploy notes
```

## Commands

`make help` lists everything. The common ones:

```sh
make install        # pnpm install (also installs the git hooks)
make lint           # oxlint + prettier --check
make typecheck      # tsc in every TypeScript package
make test           # every package's tests
make tokens-check   # fail if generated design-token files are out of date
make check          # everything CI runs
```

Commits follow Conventional Commits (enforced by a hook; `pnpm commit` gives a guided prompt). Work happens on `dev` and reaches `main` through a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).

## Docs

- [Project overview](docs/README_PROJECT_OVERVIEW.md): goals, scope, success criteria
- [Game rules](docs/README_GAME_RULES.md): commands, execution, progress, sync, publishing
- [Gameplay and features](docs/README_GAMEPLAY_FEATURES.md)
- [Visual design](docs/README_VISUAL_DESIGN.md) and [screens](docs/design/SCREENS.md)
- [Architecture](docs/README_ARCHITECTURE.md)
- [Public website plan](docs/README_WEB_PLAN.md) and [admin dashboard plan](docs/README_DASHBOARD_PLAN.md)
- [Implementation plan](docs/README_IMPLEMENTATION_PLAN.md)
- [CI, CD, and releases](docs/CI.md) and [deployment](docs/DEPLOY.md)

## License

[MIT](LICENSE)

## Security

Report vulnerabilities privately; see [SECURITY.md](SECURITY.md).
