import { describe, expect, it } from "vitest";
import { simulate, solve } from "@algomind/level-contract";
import { analyzeLevel } from "../src/modules/levels/level-analysis.js";
import { LEVELS, buildLevel } from "../src/modules/seed/starter-campaign.seed.js";
import { CAMPAIGN } from "../src/modules/seed/starter-campaign.data.js";

const built = LEVELS.map((entry) => ({
  ...entry,
  level: buildLevel(entry.def, `test-${entry.def.slug}`),
}));

describe("the starter campaign", () => {
  it("has two worlds, four chapters, and eighteen levels in a fixed order", () => {
    expect(CAMPAIGN.worlds.map((w) => w.title)).toEqual(["Basics", "Routes"]);
    expect(CAMPAIGN.worlds.flatMap((w) => w.chapters.map((c) => c.title))).toEqual([
      "Moves",
      "Turns",
      "Detours",
      "Budgets",
    ]);
    expect(LEVELS).toHaveLength(18);
  });

  it("uses each slug, title, and board once", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(LEVELS.map((l) => l.def.slug))).toBe(true);
    expect(unique(LEVELS.map((l) => l.def.title))).toBe(true);
    expect(unique(LEVELS.map((l) => l.def.rows.join("/")))).toBe(true);
  });

  it.each(built.map((b) => [b.def.slug, b] as const))(
    "%s validates, is solved by its reference program, and has a limit at or above par",
    (_slug, entry) => {
      const best = solve(entry.level);
      expect(best, "the goal is reachable").not.toBeNull();
      const analysis = analyzeLevel(entry.level, best!.program);
      expect(analysis.errors).toEqual([]);
      expect(analysis.referenceSolved).toBe(true);
      expect(simulate(entry.level, best!.program).status).toBe("SUCCEEDED");
      expect(entry.def.maxCommands).toBeGreaterThanOrEqual(best!.commands);
    },
  );

  it.each(built.map((b) => [b.def.slug, b] as const))(
    "%s offers only the commands it needs, and hints that fit",
    (_slug, entry) => {
      const best = solve(entry.level)!;
      const used = new Set(best.program.map((node) => node.op));
      // Every offered command is a real choice: the shortest program does not have to use all of
      // them, but none may be missing.
      for (const op of used) expect(entry.def.commands).toContain(op);
      expect(entry.def.commands).not.toContain("REPEAT");
      expect(entry.def.hints?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(entry.def.hints?.length ?? 0).toBeLessThanOrEqual(3);
      for (const hint of entry.def.hints ?? []) expect(hint.length).toBeLessThanOrEqual(140);
    },
  );

  it("teaches in order: Move alone first, then one turn at a time, then both", () => {
    const first = built[0]!.def.commands;
    expect(first).toEqual(["MOVE_FORWARD"]);
    const offers = (slug: string) => built.find((b) => b.def.slug === slug)!.def.commands;
    expect(offers("first-turn")).toEqual(["MOVE_FORWARD", "TURN_RIGHT"]);
    expect(offers("left-turn")).toEqual(["MOVE_FORWARD", "TURN_LEFT"]);
    expect(offers("turn-around")).toHaveLength(3);
  });

  it("gives the Budgets chapter exactly the shortest program, and Basics too", () => {
    for (const entry of built) {
      const par = solve(entry.level)!.commands;
      const world = entry.world.title;
      const chapter = entry.chapterTitle;
      if (chapter === "Budgets" || world === "Basics") {
        expect(entry.def.maxCommands, entry.def.slug).toBe(par);
      } else {
        expect(entry.def.maxCommands, entry.def.slug).toBeGreaterThan(par);
      }
    }
  });

  it("keeps every limit within what fits on a phone without loops", () => {
    for (const entry of built) expect(entry.def.maxCommands).toBeLessThanOrEqual(20);
  });
});
