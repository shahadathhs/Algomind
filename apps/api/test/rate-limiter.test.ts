import type { Request } from "express";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthController } from "../src/modules/auth/auth.controller.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import { RateLimiter } from "../src/modules/auth/rate-limiter.js";
import { failure } from "./support/http.js";

/** The table's hard cap, and the windows the routes use (rate-limiter.ts, auth.controller.ts). */
const CAP = 10_000;
const MINUTE = 60_000;

/** A limiter whose clock the test moves. */
function timed(start = 0) {
  const limiter = new RateLimiter();
  let now = start;
  limiter.clock = () => now;
  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

/** Counts the cleanups, which are private to the limiter. */
function countPrunes(limiter: RateLimiter) {
  return vi.spyOn(limiter as unknown as { prune: (now: number) => void }, "prune");
}

describe("the bucket table", () => {
  it("never holds more than the cap: a new key is refused there and gets in once entries expire", () => {
    const { limiter, advance } = timed();
    for (let i = 0; i < CAP; i++) limiter.hit(`key-${i}`, 1, MINUTE);
    expect(limiter.size).toBe(CAP);

    expect(limiter.hit("one-too-many", 1, MINUTE)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(limiter.size).toBe(CAP);

    advance(MINUTE);
    expect(limiter.hit("one-too-many", 1, MINUTE).allowed).toBe(true);
    expect(limiter.size).toBe(1);
  });

  it("frees what expired since the last cleanup before it refuses, so room is reused at once", () => {
    const { limiter, advance } = timed();
    for (let i = 0; i < CAP / 2; i++) limiter.hit(`first-${i}`, 1, MINUTE);
    advance(MINUTE / 2);
    for (let i = 0; i < CAP / 2; i++) limiter.hit(`second-${i}`, 1, MINUTE);

    // Nothing has expired yet: Retry-After says when the first half of the table does (at a minute).
    advance(MINUTE / 4);
    expect(limiter.hit("newcomer", 1, MINUTE)).toEqual({ allowed: false, retryAfterSeconds: 15 });

    // The first half has expired, although the minute cleanup is not due yet.
    advance(MINUTE / 4 + 1);
    expect(limiter.hit("newcomer", 1, MINUTE).allowed).toBe(true);
    expect(limiter.size).toBe(CAP / 2 + 1);
  });

  it("keeps counting the keys it already holds, so their limits hold while new keys are refused", () => {
    const { limiter, advance } = timed();
    expect(limiter.hit("known", 2, 1_000).allowed).toBe(true);
    for (let i = 0; i < CAP - 1; i++) limiter.hit(`key-${i}`, 1, MINUTE);
    expect(limiter.hit("known", 2, 1_000).allowed).toBe(true);
    expect(limiter.hit("known", 2, 1_000).allowed).toBe(false);
    expect(limiter.hit("stranger", 100, MINUTE).allowed).toBe(false);
    expect(limiter.size).toBe(CAP);

    // An expired bucket is replaced in place, so its key is served although the table is full.
    advance(2_000);
    expect(limiter.hit("known", 2, 1_000).allowed).toBe(true);
    expect(limiter.size).toBe(CAP);
  });
});

describe("cleanup", () => {
  it("removes expired buckets at most once a minute, not on every hit", () => {
    const { limiter, advance } = timed();
    const prune = countPrunes(limiter);
    for (let i = 0; i < 50; i++) limiter.hit(`short-${i}`, 1, 1_000);
    expect(prune).toHaveBeenCalledTimes(1); // the very first hit

    // All 50 expired, but less than a minute has passed since the cleanup.
    advance(2_000);
    for (let i = 0; i < 50; i++) limiter.hit("later", 1, 1_000);
    expect(prune).toHaveBeenCalledTimes(1);
    expect(limiter.size).toBe(51);

    advance(MINUTE);
    limiter.hit("later", 1, 1_000);
    expect(prune).toHaveBeenCalledTimes(2);
    expect(limiter.size).toBe(1);
  });
});

describe("login limits", () => {
  const RIGHT = "correct-password-xx";
  const body = (email: string, password = "wrong-password-xx") => ({ email, password });
  const from = (ip: string) => ({ ip }) as Request;

  /** The login route with a stand-in for the service, which answers 401 to a wrong password. */
  function route() {
    const limiter = new RateLimiter();
    const login = vi.fn(async (_email: string, password: string) => {
      if (password !== RIGHT) throw new UnauthorizedException({ code: "INVALID_CREDENTIALS" });
      return { accessToken: "a", refreshToken: "r", expiresIn: 900, user: {} };
    });
    return {
      limiter,
      login,
      controller: new AuthController({ login } as unknown as AuthService, limiter),
    };
  }

  it("stops one address after 60 attempts, whatever emails it tries, without a bucket per email", async () => {
    const { limiter, login, controller } = route();
    const ip = from("203.0.113.7");
    // Sixty wrong passwords, each for an email of its own: all reach the service.
    for (let i = 0; i < 60; i++) {
      const attempt = () => controller.login(body(`player-${i}@example.com`), ip);
      expect(await failure(attempt)).toMatchObject({ status: 401 });
    }
    expect(login).toHaveBeenCalledTimes(60);
    expect(limiter.size).toBe(61); // one for the address, one per email it tried

    expect(await failure(() => controller.login(body("one-more@example.com"), ip))).toMatchObject({
      status: 429,
      code: "TOO_MANY_REQUESTS",
    });
    expect(login).toHaveBeenCalledTimes(60);
    expect(limiter.size).toBe(61); // the refused attempt added no bucket

    // Another address is not affected.
    expect(
      await failure(() => controller.login(body("a@example.com"), from("203.0.113.8"))),
    ).toMatchObject({ status: 401 });
    expect(login).toHaveBeenCalledTimes(61);
  });

  it("still allows 10 attempts per email and address, and clears that count after a sign-in", async () => {
    const ip = from("203.0.113.7");
    const wrong = (controller: AuthController) => () =>
      failure(() => controller.login(body("a@example.com"), ip));

    const blocked = route();
    for (let i = 0; i < 10; i++)
      expect(await wrong(blocked.controller)()).toMatchObject({ status: 401 });
    expect(await wrong(blocked.controller)()).toMatchObject({ status: 429 });
    expect(blocked.login).toHaveBeenCalledTimes(10);

    // Nine attempts, a sign-in (which starts the count over), then ten more get through.
    const fresh = route();
    for (let i = 0; i < 9; i++)
      expect(await wrong(fresh.controller)()).toMatchObject({ status: 401 });
    await fresh.controller.login(body("a@example.com", RIGHT), ip);
    for (let i = 0; i < 10; i++)
      expect(await wrong(fresh.controller)()).toMatchObject({ status: 401 });
    expect(await wrong(fresh.controller)()).toMatchObject({ status: 429 });
    expect(fresh.login).toHaveBeenCalledTimes(9 + 1 + 10);
  });
});
