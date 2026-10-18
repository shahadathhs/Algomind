import { describe, expect, it } from "vitest";
import { type BoardData, type Dir, hasPoint } from "@/lib/board";
import { allLevels, getCampaign, grid, levelCount } from "@/lib/campaign";

const DELTA: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const LEFT: Record<Dir, Dir> = { N: "W", W: "S", S: "E", E: "N" };
const RIGHT: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };

/** Test-only breadth-first search: the fewest commands that reach the goal, or null. */
function par(board: BoardData): number | null {
  const seen = new Set<string>();
  const queue = [{ ...board.automaton, n: 0 }];
  while (queue.length > 0) {
    const s = queue.shift()!;
    const key = `${s.x},${s.y},${s.dir}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (s.x === board.goal.x && s.y === board.goal.y) return s.n;
    queue.push({ ...s, dir: LEFT[s.dir], n: s.n + 1 }, { ...s, dir: RIGHT[s.dir], n: s.n + 1 });
    const [dx, dy] = DELTA[s.dir];
    const next = { x: s.x + dx, y: s.y + dy, dir: s.dir, n: s.n + 1 };
    const inside = next.x >= 0 && next.y >= 0 && next.x < board.width && next.y < board.height;
    if (inside && !hasPoint(board.walls, next)) queue.push(next);
  }
  return null;
}

describe("grid", () => {
  it("reads walls, the target, and the automaton's facing", () => {
    const board = grid(["G.#", "...", ">.."]);
    expect(board.width).toBe(3);
    expect(board.height).toBe(3);
    expect(board.walls).toEqual([{ x: 2, y: 0 }]);
    expect(board.goal).toEqual({ x: 0, y: 0 });
    expect(board.automaton).toEqual({ x: 0, y: 2, dir: "E" });
  });

  it("rejects malformed boards", () => {
    expect(() => grid(["G..", ".."])).toThrow(/wide/);
    expect(() => grid(["G.G", "..^"])).toThrow(/one target/);
    expect(() => grid(["G..", "^.<"])).toThrow(/one automaton/);
    expect(() => grid(["G..", "..."])).toThrow(/needs/);
    expect(() => grid(["G.x", "^.."])).toThrow(/Unknown cell/);
  });
});

describe("sample campaign", () => {
  const campaign = getCampaign();
  const levels = allLevels(campaign);

  it("is marked as sample data", () => {
    expect(campaign.source).toBe("sample");
  });

  it("has numbered worlds, with chapters and levels in play order", () => {
    expect(campaign.worlds.map((w) => w.number)).toEqual(campaign.worlds.map((_, i) => i + 1));
    expect(levels.map((l) => l.number)).toEqual(levels.map((_, i) => i + 1));
    for (const world of campaign.worlds) {
      expect(world.chapters.length, world.id).toBeGreaterThan(0);
      expect(levelCount(world), world.id).toBeGreaterThan(0);
    }
  });

  it("has unique slugs and world and chapter ids", () => {
    expect(new Set(levels.map((l) => l.slug)).size).toBe(levels.length);
    expect(new Set(campaign.worlds.map((w) => w.id)).size).toBe(campaign.worlds.length);
    const chapters = campaign.worlds.flatMap((w) => w.chapters.map((c) => c.id));
    expect(new Set(chapters).size).toBe(chapters.length);
  });

  it("keeps every board valid and solvable within its command limit", () => {
    for (const l of levels) {
      expect(hasPoint(l.board.walls, l.board.automaton), l.slug).toBe(false);
      expect(hasPoint(l.board.walls, l.board.goal), l.slug).toBe(false);
      const shortest = par(l.board);
      expect(shortest, `${l.slug} is solvable`).not.toBeNull();
      expect(shortest!, `${l.slug} fits its limit`).toBeLessThanOrEqual(l.maxCommands);
    }
  });

  it("gives the last world exactly the shortest program as its limit", () => {
    const limits = campaign.worlds[campaign.worlds.length - 1];
    for (const chapter of limits.chapters) {
      for (const l of chapter.levels) expect(par(l.board), l.slug).toBe(l.maxCommands);
    }
  });
});
