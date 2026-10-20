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
  it("has four worlds, eight chapters, and thirty-six levels in a fixed order", () => {
    expect(CAMPAIGN.worlds.map((w) => w.title)).toEqual(["Basics", "Routes", "Loops", "Until"]);
    expect(CAMPAIGN.worlds.flatMap((w) => w.chapters.map((c) => c.title))).toEqual([
      "Moves",
      "Turns",
      "Detours",
      "Budgets",
      "Repeat",
      "Patterns",
      "Run to the wall",
      "Corridors",
    ]);
    expect(LEVELS).toHaveLength(36);
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
      // Each loop belongs to one world: Repeat to world 3, Repeat until to world 4, neither earlier.
      expect(entry.def.commands.includes("REPEAT")).toBe(entry.world.title === "Loops");
      expect(entry.def.commands.includes("REPEAT_UNTIL")).toBe(entry.world.title === "Until");
      expect(entry.def.hints?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(entry.def.hints?.length ?? 0).toBeLessThanOrEqual(3);
      for (const hint of entry.def.hints ?? []) expect(hint.length).toBeLessThanOrEqual(140);
    },
  );

  it("offers every movement command from the first level, and each loop only in its world", () => {
    const movement = ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"];
    const loopOf: Record<string, string[]> = { Loops: ["REPEAT"], Until: ["REPEAT_UNTIL"] };
    for (const entry of built) {
      const expected = [...movement, ...(loopOf[entry.world.title] ?? [])];
      expect(entry.def.commands, entry.def.slug).toEqual(expected);
    }
  });

  it("gives the Budgets chapter, Basics, Loops, and Until exactly the shortest program", () => {
    for (const entry of built) {
      const par = solve(entry.level)!.commands;
      const world = entry.world.title;
      const chapter = entry.chapterTitle;
      if (chapter === "Budgets" || world === "Basics" || world === "Loops" || world === "Until") {
        expect(entry.def.maxCommands, entry.def.slug).toBe(par);
      } else {
        expect(entry.def.maxCommands, entry.def.slug).toBeGreaterThan(par);
      }
    }
  });

  it("keeps every limit within what fits on a phone", () => {
    for (const entry of built) expect(entry.def.maxCommands).toBeLessThanOrEqual(20);
  });

  // The plain program must be longer than the limit, and by how much depends on the loop: a counted
  // loop saves at least half, a loop that runs to the wall also pays for the turns between runs.
  const loopWorlds = [
    { world: "Loops", op: "REPEAT", ratio: 2 },
    { world: "Until", op: "REPEAT_UNTIL", ratio: 1.5 },
  ];

  it.each(loopWorlds)("makes every $world level need a loop", ({ world, ratio }) => {
    for (const entry of built.filter((b) => b.world.title === world)) {
      const plain = solve({
        ...entry.level,
        availableCommands: entry.level.availableCommands.filter(
          (c) => c !== "REPEAT" && c !== "REPEAT_UNTIL",
        ),
      })!;
      expect(plain.commands, entry.def.slug).toBeGreaterThan(entry.def.maxCommands);
      // A loop is not a marginal gain.
      expect(plain.commands, entry.def.slug).toBeGreaterThanOrEqual(ratio * entry.def.maxCommands);
    }
  });

  it.each(loopWorlds)(
    "solves every $world level with a program that uses its loop",
    ({ world, op }) => {
      for (const entry of built.filter((b) => b.world.title === world)) {
        const program = solve(entry.level)!.program;
        expect(
          program.some((node) => node.op === op),
          entry.def.slug,
        ).toBe(true);
      }
    },
  );
});
