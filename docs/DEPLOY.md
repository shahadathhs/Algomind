# Deploying Algomind (Render + Neon + Vercel)

> **Status: live.** The API (Render and Neon) and the web app (Vercel) were deployed and checked on 2026-10-18 (details below). The Render deploy hook and the Vercel rebuild hook are configured as GitHub secrets, but the automated deploy path through them has not run yet. Provider UIs change; check each provider's current documentation, and correct this file afterwards.

## Live deployment

| Piece              | Where                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Website            | https://playalgomind.vercel.app (placeholder pages: landing, download, a noindex `/admin`) |
| API                | https://algomind-api.onrender.com                                                          |
| API docs (Swagger) | https://algomind-api.onrender.com/docs                                                     |
| API health         | `/v1/health` (liveness) and `/v1/health/ready` (database)                                  |

Checked on 2026-10-18: the API answers liveness and readiness with the database up; the website serves every page; the website's `/admin` page reads `READY` from the live API; `robots.txt` disallows `/admin`.

## Overview

| Piece                | Host                                                                                                                     | Notes                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| API (`apps/api`)     | Render web service, built from a Dockerfile                                                                              | One instance while rate limiting is in-process (login, refresh, change-password) |
| Database             | Neon PostgreSQL                                                                                                          | Backups enabled; same region family as the API                                   |
| Web app (`apps/web`) | Vercel                                                                                                                   | Public site and `/admin` in one project                                          |
| Game                 | GitHub Releases hold the Android build (APK only, not on Google Play). A web export served at `/play` is a later option. |                                                                                  |

> **Single instance only.** If rate limits live in the API's memory, a second instance would double the limits and split their counters. Move the limiter to a shared store before scaling out.

> **Free tiers sleep.** A free Render service spins down when idle and takes a while to wake. The game must treat that as a delay, not a failure (retry with backoff), and the dashboard should show a loading state. Move to a paid instance before a public launch.

## 1. Database (Neon)

1. Create a project in a region near the Render region.
2. Copy the connection string (`postgresql://…?sslmode=require`).
3. Use the **direct** connection (a host without `-pooler`): migrations run when the container starts, and a connection pooler can interfere with them. If the string ends with `&channel_binding=require`, remove that part and keep `?sslmode=require`; the Node driver may not accept it.
4. Keep it out of git. It becomes `DATABASE_URL` on Render.

## 2. API (Render)

1. Connect the repository and create the service from the blueprint (`render.yaml`) or manually: Docker runtime, Dockerfile in `apps/api`, health check at `/v1/health`.
2. Restrict rebuilds to changes under `apps/api/**` and `packages/**` (the blueprint does this).
3. Set environment variables. Today the API reads:
   - `NODE_ENV=production`
   - `DATABASE_URL` (from Neon; required, there is no default)
   - `CORS_ORIGINS` (the exact web origin, comma-separated for several, no trailing slash: `https://playalgomind.vercel.app`)

   - `JWT_ACCESS_SECRET` (signs access tokens; at least 32 characters; required in production, the blueprint generates it)
   - `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASS` (first run only: the first admin is created when no admin exists; the API refuses to start in production without them while there is no admin, or with a password under 12 characters; the first sign-in forces a new password, after which you can remove both)
   - `TRUST_PROXY=1` (Render has one reverse proxy; without it every client looks like the proxy and rate limits collapse into one bucket)
   - `SEED_STARTER_CAMPAIGN` (`true` or `false`; defaults to `false` in production and `true` elsewhere, and the blueprint sets `false`). When `true`, startup creates the starter campaign if it is missing: four worlds, five chapters, and nineteen published levels (each checked by the validator and solver) with a recorded "seed" playtest, and a client-registry row for the API's version that is the minimum supported version when none exists. It skips anything that already exists by slug, so it is safe to leave on; it never edits or deletes. The public `/levels` page reads the published campaign from the API, so on a fresh production database it shows "could not be loaded" until levels exist: set this to `true` once to get the nineteen starter levels, or publish levels from the dashboard; with it off, add a client version under `/v1/admin/client-versions` before the first publish.
   - Optional: `ACCESS_TOKEN_TTL_SECONDS` (default 900) and `REFRESH_TOKEN_TTL_DAYS` (default 7)

   Added when the features land: `WEB_REVALIDATE_URL` with `WEB_REVALIDATE_SECRET` so publish can revalidate public pages.

4. The start command applies migrations (`prisma migrate deploy`) and then starts the server. Do not use `prisma db push` or `migrate dev` in production.
5. Create a deploy hook and an API key for CI (see [CI.md](CI.md)). Consider disabling auto-deploy so the hook is the only path and CD verifies the deploy that runs.

## 3. Web app (Vercel)

1. Import the repository; set the root directory to `apps/web` with the workspace install.
2. Set environment variables: `API_BASE_URL` (server-side, `https://algomind-api.onrender.com/v1`; the only one the site needs today) and, optionally, `SITE_URL` (the public origin used in the sitemap and metadata; it defaults to `https://playalgomind.vercel.app`, so set it only for a custom domain). Later: the revalidation secret.
3. Add a Deploy Hook for `main` and store it as the `VERCEL_DEPLOY_HOOK` secret in GitHub so the site rebuilds after a new release is published (and, later, after a new web export).
4. Confirm `/admin` routes are not indexed and public pages render without JavaScript.

## 4. Smoke test

```sh
BASE=https://algomind-api.onrender.com
curl $BASE/v1/health                      # first call after a sleep can be slow
curl $BASE/v1/health/ready                # {"status":"ok","database":"up"}
# Once those routes exist:
curl $BASE/v1/levels                      # public catalog (published only)
curl -i $BASE/v1/admin/levels             # expect 401 without a token

# The website reads the API server-side; its admin page reports the result:
curl -s https://playalgomind.vercel.app/admin | grep -o 'READY\|UNREACHABLE'
```

Once the dashboard exists: sign in to `/admin`, create a level, validate it, publish it, and confirm it appears in `GET /v1/levels`, on the public catalog page, and in the game.

## 5. Point the game at it

The Android build receives the API URL at build time from the `API_BASE_URL` repository variable. It must be HTTPS and end in `/v1`. A build without a URL should behave as a clean offline game using only bundled levels.

## Operations

- **New migration:** commit and push; CI applies it to a test database, and the start command applies it in production.
- **Rotate secrets:** change `JWT_ACCESS_SECRET` in Render (access tokens stop working until clients refresh) and rotate the seeded admin password.
- **Backups:** enable and test restoring from Neon backups before publishing real content.
- **Rollback:** redeploy an earlier deploy from Render's events; unpublish a bad level from the dashboard.
- **Logs and health:** use Render logs and the health endpoint; add uptime monitoring for the API and web.
