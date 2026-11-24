import { problem } from "./problem";

/**
 * Per-client limits for the session routes, counted in this process's memory.
 *
 * The API limits login and refresh per address, but every admin reaches it through this web
 * server, so they all share one bucket there: sixty unauthenticated posts from anywhere would
 * have the API answer 429 to every admin. These limits keep one client from spending that bucket.
 * Each route has a short window for a burst (tabs opening, retries) and the API's own 15-minute
 * window, because the per-minute numbers alone would let one address spend the API's 60 for
 * refresh in three minutes, a few requests at a time.
 *
 * Per instance (serverless): each instance counts on its own and forgets everything when it is
 * recycled, so the real ceiling is these limits times the number of instances. It backs up the
 * API's limits; it does not replace them.
 */

const MINUTE_MS = 60_000;
/** The length of the API's own windows. */
const API_WINDOW_MS = 15 * MINUTE_MS;

/** What one client address may send to each session route in each window. */
const LIMITS = {
  login: { burst: 10, sustained: 10 },
  refresh: { burst: 20, sustained: 30 },
} as const;

export type SessionRoute = keyof typeof LIMITS;

type Bucket = { count: number; resetAt: number };

/** The most clients remembered at once, so a flood of addresses cannot grow the table without end. */
const MAX_TRACKED = 10_000;

const buckets = new Map<string, Bucket>();

function forgetClosed(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Counts the request for `key`, and says how many seconds the client must wait when it already
 * sent `max` in the window (0 when it may pass). A request that has to wait is not counted.
 */
function waitAfter(key: string, max: number, windowMs: number): number {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now) {
    if (bucket.count >= max) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    bucket.count += 1;
    return 0;
  }
  // The first request of a window.
  if (bucket) {
    bucket.count = 1;
    bucket.resetAt = now + windowMs;
  } else {
    if (buckets.size >= MAX_TRACKED) forgetClosed(now);
    // A table that is still full holds active clients only. A new client then passes uncounted:
    // refusing it would let a flood lock every newly arriving admin out at this layer.
    if (buckets.size < MAX_TRACKED) buckets.set(key, { count: 1, resetAt: now + windowMs });
  }
  return 0;
}

function firstAddress(header: string | null): string | null {
  const first = header?.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * The address the platform reports for the caller, or null when none does. Vercel sets
 * `x-vercel-forwarded-for` itself (the VERCEL environment variable marks it), so a caller cannot
 * choose it. Anywhere else the first entry of `x-forwarded-for` is used, which is only as
 * trustworthy as the proxy in front of the web app.
 */
function clientAddress(req: Request): string | null {
  const vercel = process.env.VERCEL ? req.headers.get("x-vercel-forwarded-for") : null;
  return firstAddress(vercel ?? req.headers.get("x-forwarded-for"));
}

/**
 * How many seconds the client must wait before `route` serves it again, or null when it may
 * pass now. A session route answers a wait with `rateLimited`.
 */
export function retryAfter(req: Request, route: SessionRoute): number | null {
  const address = clientAddress(req);
  const client = `${route}:${address ?? "unknown"}`;
  const { burst, sustained } = LIMITS[route];
  const wait = waitAfter(`${client}:${MINUTE_MS}`, burst, MINUTE_MS);
  if (wait) return wait;
  // Without an address every caller shares one bucket: the long window would then limit every
  // admin together, so only the short one applies.
  if (address === null) return null;
  return waitAfter(`${client}:${API_WINDOW_MS}`, sustained, API_WINDOW_MS) || null;
}

/** The 429 a limited session route answers: the API's error shape, with Retry-After. */
export function rateLimited(seconds: number): Response {
  return problem(429, "RATE_LIMITED", "Too many attempts. Wait and try again.", seconds);
}
