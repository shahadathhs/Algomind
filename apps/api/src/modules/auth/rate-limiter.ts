import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

type Bucket = { count: number; resetAt: number };

/** The most buckets held at once. Beyond it a new key is refused until an entry expires. */
const MAX_BUCKETS = 10_000;
/** How often expired buckets are removed. */
const PRUNE_INTERVAL_MS = 60_000;

const secondsUntil = (at: number, now: number): number => Math.max(1, Math.ceil((at - now) / 1000));

/**
 * Fixed-window counters held in process memory. They are per instance and reset on restart, so
 * this is correct for a single instance only (docs/DEPLOY.md). Move to a shared store before
 * running more than one.
 *
 * The table holds at most MAX_BUCKETS buckets, so a flood cannot grow it without end. A key that
 * already has a bucket always counts, so the limits hold under a flood; a request that needs a
 * new bucket while the table is full is refused (429 with Retry-After) without creating one.
 * Expired buckets are removed at most once per PRUNE_INTERVAL_MS, and otherwise only when the
 * table is full and a new key needs room, so no hit scans the table every time.
 */
@Injectable()
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  /** When expired buckets were last removed. */
  private prunedAt = Number.NEGATIVE_INFINITY;
  /** When the first bucket in the table expires. */
  private nextExpiry = Number.POSITIVE_INFINITY;

  /** Replaced in tests to move time without waiting. */
  clock: () => number = Date.now;

  /** The buckets held; never more than the cap. */
  get size(): number {
    return this.buckets.size;
  }

  /** Counts one attempt against `key`; `allowed` is false once `limit` is exceeded in the window. */
  hit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = this.clock();
    if (now - this.prunedAt >= PRUNE_INTERVAL_MS) this.prune(now);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      // An expired bucket is replaced in place, so only a new key can grow the table.
      if (!bucket && this.buckets.size >= MAX_BUCKETS) {
        // Free what expired since the last cleanup before refusing.
        this.prune(now);
        if (this.buckets.size >= MAX_BUCKETS) {
          return { allowed: false, retryAfterSeconds: secondsUntil(this.nextExpiry, now) };
        }
      }
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      this.nextExpiry = Math.min(this.nextExpiry, bucket.resetAt);
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= limit,
      retryAfterSeconds: secondsUntil(bucket.resetAt, now),
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Removes the expired buckets and notes when the next one expires. */
  private prune(now: number): void {
    let next = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
      else next = Math.min(next, bucket.resetAt);
    }
    this.nextExpiry = next;
    this.prunedAt = now;
  }
}

/** 429 with a Retry-After hint (the error filter turns `retryAfter` into the header). */
export function tooManyRequests(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Try again later.",
      retryAfter: retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
