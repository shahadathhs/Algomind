import { describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../src/modules/auth/rate-limiter.js";
import { PasswordService } from "../src/modules/auth/password.service.js";
import type { AuthenticatedRequest } from "../src/modules/auth/auth.types.js";
import { MeController } from "../src/modules/me/me.controller.js";
import { MeService } from "../src/modules/me/me.service.js";
import { FakeDb } from "./support/fake-db.js";
import { failure } from "./support/http.js";

const PLAYER = "player-1";

/** The cap on what one player keeps (me.service.ts). */
const CAP = 1000;

const slug = (i: number) => `level-${String(i).padStart(4, "0")}`;
const completion = (i: number, extra: Record<string, unknown> = {}) => ({
  levelSlug: slug(i),
  levelVersion: 1,
  bestCommands: 6,
  ...extra,
});
const first = (i: number) => Array.from({ length: i }, (_, n) => completion(n));

/** The progress service for one signed-in player, over the fake database. */
async function setup() {
  const db = new FakeDb();
  await db.user.create({ data: { id: PLAYER, email: "player@example.com" } });
  return { db, me: new MeService(db.asPrisma(), new PasswordService()) };
}

describe("stored completions", () => {
  it("keep at most 1,000 levels per player: a completion beyond the cap is ignored, not refused", async () => {
    const { db, me } = await setup();
    await me.sync(PLAYER, { completed: first(CAP) });
    expect(db.levelProgress.rows).toHaveLength(CAP);

    const view = await me.sync(PLAYER, {
      completed: [completion(500, { bestCommands: 2 }), completion(5000), completion(5001)],
    });
    expect(db.levelProgress.rows).toHaveLength(CAP);
    expect(view.completed).toHaveLength(CAP);
    // A level already stored still improves.
    expect(view.completed.find((c) => c.levelSlug === slug(500))).toMatchObject({
      levelVersion: 1,
      bestCommands: 2,
    });
    expect(view.completed.map((c) => c.levelSlug)).not.toContain(slug(5000));
  });

  it("store nothing past the cap even when one sync carries more than 1,000", async () => {
    const { db, me } = await setup();
    await me.sync(PLAYER, { completed: first(CAP + 200) });
    expect(db.levelProgress.rows).toHaveLength(CAP);
    expect(db.levelProgress.rows.map((r) => r.levelSlug)).toContain(slug(CAP - 1));
  });
});

describe("the sync route", () => {
  const request = (id: string) => ({ user: { id } }) as AuthenticatedRequest;

  /** The route with a stand-in for the service. */
  function route() {
    const sync = vi.fn(async () => ({ completed: [], settings: null }));
    const limiter = new RateLimiter();
    return {
      sync,
      limiter,
      controller: new MeController({ sync } as unknown as MeService, limiter),
    };
  }

  it("is limited to 60 a minute per player, answered with 429 and Retry-After", async () => {
    const { sync, controller } = route();
    for (let i = 0; i < 60; i++) await controller.sync({ completed: [] }, request(PLAYER));
    expect(sync).toHaveBeenCalledTimes(60);

    const refused = await failure(() => controller.sync({ completed: [] }, request(PLAYER)));
    expect(refused).toMatchObject({ status: 429, code: "TOO_MANY_REQUESTS", retryAfter: 60 });
    expect(sync).toHaveBeenCalledTimes(60);

    // Another player is not affected.
    await controller.sync({ completed: [] }, request("player-2"));
    expect(sync).toHaveBeenCalledTimes(61);
  });
});
