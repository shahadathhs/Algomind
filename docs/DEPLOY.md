# Deploying Algomind (Render + Neon + Vercel)

> **Status: planned.** Nothing here has been run yet. Provider UIs and blueprint syntax change; check each provider's current documentation when you perform these steps, and correct this file afterwards.

## Overview

| Piece | Host | Notes |
|---|---|---|
| API (`apps/api`) | Render web service, built from a Dockerfile | One instance while rate limiting is in-process |
| Database | Neon PostgreSQL | Backups enabled; same region family as the API |
| Web app (`apps/web`) | Vercel | Public site and `/admin` in one project |
| Game | GitHub Releases hold the Android build (APK only, not on Google Play). A web export served at `/play` is a later option. | |

> **Single instance only.** If rate limits live in the API's memory, a second instance would double the limits and split their counters. Move the limiter to a shared store before scaling out.

> **Free tiers sleep.** A free Render service spins down when idle and takes a while to wake. The game must treat that as a delay, not a failure (retry with backoff), and the dashboard should show a loading state. Move to a paid instance before a public launch.

## 1. Database (Neon)

1. Create a project in a region near the Render region.
2. Copy the connection string (`postgresql://…?sslmode=require`).
3. Keep it out of git. It becomes `DATABASE_URL` on Render.

## 2. API (Render)

1. Connect the repository and create the service from the blueprint (`render.yaml`) or manually: Docker runtime, Dockerfile in `apps/api`, health check at `/v1/health`.
2. Restrict rebuilds to changes under `apps/api/**` and `packages/level-contract/**`.
3. Set environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL` (from Neon)
   - `JWT_SECRET` (generated; the app refuses to start in production with a weak or default value)
   - `CORS_ORIGINS` (the exact web origin)
   - `WEB_REVALIDATE_URL` and `WEB_REVALIDATE_SECRET` (so publish can revalidate public pages)
   - Seed admin credentials (`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASS`) for the first run only; remove or rotate afterwards
4. The start command applies migrations (`prisma migrate deploy`) and then starts the server. Do not use `prisma db push` or `migrate dev` in production.
5. Create a deploy hook and an API key for CI (see [CI.md](CI.md)). Consider disabling auto-deploy so the hook is the only path and CD verifies the deploy that runs.

## 3. Web app (Vercel)

1. Import the repository; set the root directory to `apps/web` with the workspace install.
2. Set environment variables: the API base URL (server-side), the revalidation secret, and any public site URL.
3. Add a Deploy Hook for `main` and store it as the `VERCEL_DEPLOY_HOOK` secret in GitHub so the site rebuilds after a new release is published (and, later, after a new web export).
4. Confirm `/admin` routes are not indexed and public pages render without JavaScript.

## 4. Smoke test

```sh
BASE=https://<api-host>
curl $BASE/v1/health                      # first call after a sleep can be slow
curl $BASE/v1/levels                      # public catalog (published only)
curl -i $BASE/v1/admin/levels             # expect 401 without a token
```

Then sign in to `/admin`, create a level, validate it, publish it, and confirm it appears in `GET /v1/levels`, on the public catalog page, and in the game.

## 5. Point the game at it

The Android build receives the API URL at build time from the `API_BASE_URL` repository variable. It must be HTTPS and end in `/v1`. A build without a URL should behave as a clean offline game using only bundled levels.

## Operations

- **New migration:** commit and push; CI applies it to a test database, and the start command applies it in production.
- **Rotate secrets:** change `JWT_SECRET` in Render (this signs everyone out) and rotate the seeded admin password.
- **Backups:** enable and test restoring from Neon backups before publishing real content.
- **Rollback:** redeploy an earlier deploy from Render's events; unpublish a bad level from the dashboard.
- **Logs and health:** use Render logs and the health endpoint; add uptime monitoring for the API and web.
