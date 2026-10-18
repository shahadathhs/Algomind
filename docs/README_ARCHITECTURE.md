# Algomind — Architecture

> **Architecture goal:** Support a Godot mobile game whose levels are created and published from an admin dashboard from day one, without requiring a game-client rebuild for compatible content changes, alongside a public website that shares the same web codebase.

## 1. High-level architecture

```text
                    ┌──────────────────────────────────────┐
                    │ Next.js web app (apps/web)           │
                    │  (public)  landing · levels · play   │
                    │  (admin)   author · preview · publish│
                    └──────────────────┬───────────────────┘
                                       │ HTTPS / REST
                                       ▼
┌─────────────────────┐       ┌──────────────────────────┐
│ Godot Game Client   │──────▶│ NestJS API (apps/api)    │
│ Board + Simulation  │ HTTPS │ Auth / Catalog / Versions│
│ Local Cache         │◀──────│ Validation / Publishing  │
└─────────────────────┘       └────────────┬─────────────┘
                                           │ Prisma
                                           ▼
                                ┌─────────────────────┐
                                │ PostgreSQL          │
                                │ Levels + Versions   │
                                │ Admins (+ progress) │
                                └─────────────────────┘

        packages/level-contract: schema · validator · reference simulator · fixtures
        (consumed by api and web; mirrored and fixture-verified in Godot)
```

The Godot client and the Next.js web app are independent clients of the NestJS API. The web app is not a proxy that the game must call. The public API serves published content; protected API routes handle dashboard operations.

## 2. Responsibilities

### Godot game client

Owns:

- Rendering the board and automaton.
- Command/program editing.
- Deterministic puzzle simulation (GDScript implementation of the contract's rules).
- Client-side checks that fetched level data has the required shape.
- Loading, retry, offline, and cache behavior.
- Local settings and initial local progress.
- The Android build and the web export hosted by the public site at `/play`.

Does not own:

- Authoritative draft/published status.
- Admin authentication or authorization.
- Editing content for publication.
- Database access.
- Executing arbitrary scripts downloaded from the server.

### Next.js web app (`apps/web`)

One codebase, two audiences, separated by route groups:

- `(public)`: landing page, level catalog and level detail, `/play` (embeds the game's web export), download, privacy, contact. Server-rendered or statically generated with revalidation; it must work without client JavaScript except the user-started game island.
- `(admin)` under `/admin`: sign-in, level list, level editor, board editor, preview, validation panel, publish and unpublish, version history. Client-heavy and dynamic; never indexed or cached publicly.

Owns:

- Admin-facing and public UI and navigation.
- Calling the NestJS API for all data and operations.
- Client-side form validation for usability and live preview using the shared reference simulator.
- Displaying validation errors and publication summaries.

It is not the source of truth for permissions. The API must enforce authorization and validate submitted content independently. Hiding links or protecting routes in Next.js is not authorization.

Separation rules inside `apps/web`:

- Directories: `components/public`, `components/admin`, and a shared `components/ui`. Admin code does not import from public pages and vice versa, only from shared UI and `lib`.
- Admin routes send `noindex`, are excluded from `robots.ts` and the sitemap, and are never statically cached.
- Heavy editor dependencies load only inside `/admin` routes so they never enter the public bundle.
- One shared token set (palette, spacing, radius) for both areas; the dashboard may be more utilitarian than the public site.

### NestJS API (`apps/api`)

Owns:

- Admin authentication and authorization.
- Level and version lifecycle.
- Server-side validation of level definitions, including a solvability check using the reference solution and the shared reference simulator.
- Public catalog and published-level retrieval.
- Publication transactions and audit metadata.
- Optional player identity, progress, and score endpoints when that scope is approved.
- Rate limits, logging, API versioning, health checks, and response errors.
- Notifying the web app to revalidate public pages after publish/unpublish.

### PostgreSQL

Stores relational metadata and immutable level versions. JSONB is suitable for the structured board definition as long as it is validated against an explicit schema before publication and when served to clients.

## 3. Recommended stack

| Layer | Choice |
|---|---|
| Game | Godot 4.x, GDScript, GUT tests, gdtoolkit (gdlint, gdformat); headless Godot in Docker |
| Web | Next.js App Router, TypeScript, Tailwind CSS |
| API | NestJS 11, TypeScript, REST/JSON, Swagger (OpenAPI) at `/docs` |
| Persistence | PostgreSQL |
| ORM/migrations | Prisma (split schema files, migrations committed, generated client not committed) |
| Level contract | JSON Schema plus shared TypeScript types, validator, and reference simulator |
| Monorepo | pnpm workspace for `apps/api`, `apps/web`, and `packages/*` only |
| Lint and format | oxlint (type-aware) plus prettier for all TypeScript (no ESLint: TypeScript 7 has no JS compiler API for typescript-eslint); gdlint and gdformat for GDScript |
| Git tooling | Husky, lint-staged, commitlint (Conventional Commits), commitizen with cz-git |
| API tests | Jest unit tests plus e2e tests against a real PostgreSQL service |
| Web tests | Component and unit tests for the editor and validators; Playwright smoke tests for sign-in and the publish flow |
| CI/CD | One GitHub Actions workflow; see [CI.md](CI.md) |
| Hosting | Render (API, Docker), Neon (PostgreSQL), Vercel (web); see [DEPLOY.md](DEPLOY.md) |

Select exact versions during implementation and pin them. Keep the first deployment simple; do not add Kubernetes, microservices, a queue, Redis, WebSockets, or a separate cache server without a demonstrated need.

The NestJS API is built from a clean skeleton. Do not carry over generic starter features that Algomind does not use (chat, WebRTC, background queues, file/media services, cloud storage integrations).

## 4. Repository shape

A monorepo is convenient for a solo developer, but keep the applications isolated.

```text
 Algomind/
 ├── apps/
 │   ├── game/                       # Godot project.godot and assets
 │   ├── web/                        # Next.js: (public) and (admin) route groups
 │   └── api/                        # NestJS + Prisma
 ├── packages/
 │   └── level-contract/
 │       ├── schema/                 # Versioned JSON Schema
 │       ├── fixtures/               # Valid and invalid levels, plus programs with expected outcomes
 │       └── src/                    # TS types, validator, reference simulator
 ├── docs/
 ├── docker/
 ├── scripts/
 ├── Makefile
 ├── VERSION
 ├── .env.example
 ├── pnpm-workspace.yaml             # TypeScript apps/packages only
 └── README.md
```

Godot can be stored beside the JavaScript applications, but it should not be included in pnpm build commands. The schema and fixtures are the cross-language contract. Godot implements equivalent validation and simulation in GDScript; it does not import TypeScript at runtime.

## 5. Level data contract

The API must return **data**, not code. Keep the schema explicit and versioned. The following is an illustrative starting format; the exact names can change before the schema is committed.

```json
{
  "schemaVersion": 1,
  "levelId": "level-intro-001",
  "levelVersion": 1,
  "slug": "first-steps",
  "title": "First Steps",
  "description": "Reach the goal using the available commands.",
  "difficulty": "easy",
  "sortOrder": 1,
  "requires": { "mechanics": [] },
  "board": {
    "width": 5,
    "height": 5,
    "walls": [[1, 1], [1, 2], [3, 3]]
  },
  "initialState": {
    "position": [0, 4],
    "direction": "north"
  },
  "availableCommands": ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"],
  "constraints": {
    "maxCommands": 8,
    "maxSteps": 30
  },
  "goal": {
    "type": "reach_tile",
    "position": [4, 0]
  },
  "hints": [
    "Look for a route around the wall.",
    "A turn changes the direction of the next move."
  ]
}
```

Do not treat this example as permission to ship without schema validation. Validate coordinate ranges, board-size limits, supported command names, required fields, goal references, string length limits, and any object/mechanic-specific rules. The server must reject unknown or unsupported schema versions rather than silently guessing.

If more board mechanics are added later (switches, doors, items), model them as a typed `entities` array rather than adding a new top-level key for each.

### Mechanics and client compatibility

`requires.mechanics` lists the mechanics a level uses. Each game build declares the set of mechanics it supports, and the catalog response lets a client skip or flag levels it cannot play. The dashboard may only publish a mechanic that the currently deployed client declares as supported.

### Reference solution

Authoring content includes a reference solution (a command sequence). It is stored with the draft and each version, used by the API to confirm the level is solvable within its constraints, and is **not** returned by public endpoints.

### Shared simulation

The reference simulator in `packages/level-contract` is used by the dashboard preview and by the API's publish-time check. The game's GDScript simulator implements the same rules. `fixtures/` contains levels, programs, and the expected result and step trace for each; the TypeScript tests and the GUT tests both run every fixture. A fixture failing in either implementation blocks merge.

### Schema evolution

- `schemaVersion` changes when the structure/meaning of the JSON contract changes incompatibly.
- `levelVersion` changes when the content for a specific level is republished.
- A new level content version should not imply a new schema version.
- Clients should reject a schema they do not support and show a friendly update/load error.
- Keep examples and test fixtures for each supported schema version.

## 6. Data model

### `AdminUser`

- `id`
- `email` (unique)
- `passwordHash`
- `role` (start with `ADMIN`; introduce editor roles only when needed)
- `createdAt`, `updatedAt`

Use a reputable authentication approach. Store only a strong password hash, never plaintext or reversible passwords. Do not build custom cryptography. The first admin is created by a seed script driven by environment variables; there is no public sign-up.

### `Level`

- `id` (stable UUID or equivalent)
- `slug` (unique)
- `title`
- `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
- `difficulty`
- `sortOrder`
- `currentPublishedVersionId` (nullable)
- `createdBy`, `updatedBy`
- `createdAt`, `updatedAt`

A published level may also have unpublished edits in progress. Keep the working draft content on the level (or a draft version row) separately from published versions, so editing never alters what players receive.

### `LevelVersion`

- `id`
- `levelId`
- `versionNumber`
- `schemaVersion`
- `content` (validated JSON/JSONB)
- `referenceSolution` (validated; never served publicly)
- `validationSummary` (optional non-sensitive diagnostics)
- `createdBy`
- `createdAt`
- `publishedAt` (nullable)

Add a unique constraint for `(levelId, versionNumber)`. Once published, a version is immutable. Edits create a draft or a new candidate version; publication must not mutate the version that existing clients are using.

### Optional later tables

- `Player` or `PlayerIdentity` for cloud saves/accounts.
- `LevelProgress` keyed by player and level, tracking best completed version/result.
- `ScoreSubmission` if a leaderboard is added.
- `AuditEvent` for tracing admin publication/unpublication actions.

Do not create player tables merely because they might be useful later. Local progress is adequate for the first playable release.

## 7. API shape

Prefix routes with `/v1` consistently. JSON responses should have documented types and predictable errors. Document them with OpenAPI.

### Public/player endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/v1/levels` | List published levels and lightweight metadata |
| `GET` | `/v1/levels/:slug` | Retrieve the current published level version |
| `GET` | `/v1/health` | Liveness/readiness endpoint for hosting and diagnostics |

Optional, later:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/v1/progress` | Save authenticated or appropriately identified progress |
| `GET` | `/v1/me/progress` | Retrieve player progress |
| `POST` | `/v1/scores` | Submit a result for a defined challenge mode |

### Admin endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/v1/auth/login` | Admin sign-in; returns a short-lived access token and a refresh token |
| `POST` | `/v1/auth/refresh` | Exchange a refresh token for a new access token and a new refresh token (rotation) |
| `POST` | `/v1/auth/logout` | Revoke the current refresh token |
| `POST` | `/v1/admin/levels` | Create a draft level |
| `GET` | `/v1/admin/levels` | List drafts and published levels |
| `GET` | `/v1/admin/levels/:id` | Read metadata and authoring content |
| `PATCH` | `/v1/admin/levels/:id` | Update a draft; do not mutate a published version |
| `POST` | `/v1/admin/levels/:id/validate` | Return field-level validation issues, including solvability |
| `POST` | `/v1/admin/levels/:id/publish` | Publish a validated immutable version |
| `POST` | `/v1/admin/levels/:id/unpublish` | Remove the level from future public catalog responses |
| `GET` | `/v1/admin/levels/:id/versions` | List content versions |

Route names are suggestions; choose a consistent convention. Every admin route must check identity and role on the server.

## 8. Publication lifecycle

Recommended lifecycle:

1. Create/edit a draft.
2. Save draft to the server.
3. Validate the entire definition against the current schema and gameplay rules.
4. Preview using the shared reference simulator and run the reference solution.
5. Publish transactionally: create an immutable `LevelVersion`, update the level's published-version pointer/status, record author and timestamp.
6. Public endpoints return only the published version.
7. Ask the web app to revalidate affected public pages.
8. To change a published level, create and validate a new version; do not rewrite the previous published version.
9. To unpublish, remove it from new catalog results while retaining content for audit/rollback.

A draft save is not a publish. Client-side validation improves the editing experience, but server-side validation is the authority.

## 9. API response and caching behavior

- Return only levels in `PUBLISHED` state from public endpoints.
- Include `schemaVersion`, `levelVersion`, and stable IDs in each level response.
- Support ETags or a version/updated marker for catalog and individual level responses when practical.
- Use appropriate cache headers for public immutable version content; invalidate or update catalog caches when publishing/unpublishing.
- The public website uses revalidating (ISR) fetches, plus on-demand revalidation triggered after publish or unpublish.
- Keep the game's client cache keyed by level ID and level version.
- Never overwrite a known-good cached level with an invalid response.
- A cached level can remain on-device after it is unpublished. Unpublishing controls future discovery/fetches; it is not a reliable remote deletion mechanism.

## 10. Authentication and security

### Admin and dashboard

- Use HTTPS in production.
- **Bearer access token with refresh token.** Sign-in returns a short-lived access token, sent as `Authorization: Bearer <token>`, and a longer-lived refresh token. Suggested defaults, to be set in configuration: access token about 15 minutes, refresh token about 7 days.
- **Refresh rotation.** Each refresh issues a new access token and a new refresh token and invalidates the old refresh token. Refresh tokens are stored server-side as hashes so they can be revoked. If an already-used refresh token is presented again, treat it as theft and revoke the whole token family.
- **Auto logout.** The web app signs the admin out automatically when a refresh fails or is rejected, when the refresh token expires, after a period of inactivity, and when the admin signs out in another tab. It clears all session state and redirects to sign-in. A 401 on an API call triggers one refresh attempt and one retry, then logout.
- **Token storage in the web app.** Keep the access token in memory only. Keep the refresh token out of JavaScript-readable storage (an httpOnly, secure, same-site cookie set by the web app's server). Never put tokens in `localStorage`. A page reload restores the session through the refresh token.
- Logout and password change revoke refresh tokens server-side.
- Protect all admin routes with authentication and server-side authorization in the API; the web app's route protection is only for user experience.
- Start with a single admin role; do not implement a complex role model prematurely.
- Rate-limit login attempts and sensitive endpoints.
- Validate input on the server and cap payload sizes.
- Avoid logging passwords, tokens, or complete sensitive auth headers.
- Store secrets in deployment environment variables, never in the Git repository or client bundle.
- Configure CORS to the exact web origins.

### Game client

- A mobile client cannot safely contain a permanent secret. Treat the public level API as public.
- Do not embed an admin credential, database password, or signing private key in the game.
- Validate remote content as untrusted input.
- Do not execute server-provided scripts or expression strings.
- Keep player-submitted scores untrusted if leaderboards are added. Server-side validation must use a defined rule, not blindly trust a client result.

### Level editor

- Restrict board size, number of entities, text length, and command count to reasonable limits.
- Validate references and coordinates before preview or publication.
- Escape/render user-authored text safely in the web app.
- Require confirmation for unpublishing or other destructive content changes.

## 11. Error contract

Use consistent HTTP status codes and an error response with a stable machine-readable code plus safe display message. For example:

```json
{
  "statusCode": 422,
  "code": "LEVEL_VALIDATION_FAILED",
  "message": "The level has validation errors.",
  "issues": [
    {
      "path": "board.width",
      "code": "OUT_OF_RANGE",
      "message": "Board width must be between 3 and 12."
    }
  ]
}
```

Do not return stack traces or secrets. The dashboard should map the issue path to a field and show a useful correction. The game should translate network and content errors into player-friendly states.

## 12. Testing strategy

### Contract (shared)

- Every fixture level validates (or fails) as declared.
- Every fixture program produces the expected result and step trace in the TypeScript reference simulator and in GDScript.

### Game

- Unit-test movement, turns, boundaries, obstacles, reset, and each goal type.
- Run identical programs against the same level fixture and verify identical results.
- Test malformed and unsupported level data.
- Test small and large boards, empty program, maximum command count, and maximum steps.

### API

- Test public routes do not expose drafts or reference solutions.
- Test anonymous users cannot access admin routes.
- Test invalid or unsolvable level content cannot be published.
- Test publication creates a new immutable version.
- Test unpublishing removes the level from future public catalog results.
- Test database constraints and rollback behavior against a real PostgreSQL instance.

### Web

- Test form validation and field-level error display.
- Test save/publish loading and failure states.
- Test that save does not publish.
- Test unsaved-change warnings and preview with representative fixtures.
- Test that admin routes are not indexable and public pages render without JavaScript.

### Integration

- Publish a level through the dashboard, fetch it from the API, load it in Godot, and solve it end to end.
- Publish a second version and verify the client can fetch it without an app rebuild.
- Simulate an API outage and verify cached/bundled content remains playable.

## 13. Observability and operations

For the MVP, use structured logs and a health endpoint. Log request IDs, route, status, elapsed time, and safe error details. Add basic monitoring for API availability and database connectivity. Avoid building custom analytics before the game is publicly usable.

Database backups and migration instructions must exist before production publishing. Keep staging and production data separated where practical.

## 14. Deployment shape

Initial deployment remains simple (details in [DEPLOY.md](DEPLOY.md)):

- Web app on Vercel.
- NestJS API as one Render service built from a Dockerfile; migrations applied on start.
- PostgreSQL on Neon with backups.
- Game builds distributed separately; the API base URL is injected per build/environment.

Use separate local/staging/production environment values. The Godot client should not require a new build just because a compatible level was published, but changing the production API URL or introducing unsupported client behavior can require a new build.

## 15. Architecture decisions to document when finalized

- Exact level schema and supported schema versions.
- Exact token lifetimes, the inactivity timeout, and the refresh-cookie mechanics between the web app and API (the model itself is settled: bearer access token, rotating refresh token, auto logout).
- API base URLs and CORS policy for the web app.
- Policy for progress when a level has a new published version.
- Whether scores are local records or server-validated competitive results.
- Where the working draft is stored relative to published versions.
