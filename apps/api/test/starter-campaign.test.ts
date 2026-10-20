import { describe, expect, it } from "vitest";
import { simulate, solve, type Program } from "@algomind/level-contract";
import { analyzeLevel } from "../src/modules/levels/level-analysis.js";
import { LEVELS, buildLevel } from "../src/modules/seed/starter-campaign.seed.js";
import { CAMPAIGN } from "../src/modules/seed/starter-campaign.data.js";

const built = LEVELS.map((entry) => ({
  ...entry,
  level: buildLevel(entry.def, `test-${entry.def.slug}`),
}));

/** The reference solution: the one in the data (levels with IF), else the exact solver's. */
const referenceOf = (entry: (typeof built)[number]): readonly unknown[] =>
  entry.def.solution ?? solve(entry.level)!.program;

describe("the starter campaign", () => {
  it("has six worlds, twelve chapters, and fifty-two levels in a fixed order", () => {
    expect(CAMPAIGN.worlds.map((w) => w.title)).toEqual([
      "Basics",
      "Routes",
      "Loops",
      "Until",
      "Decisions",
      "Procedures",
    ]);
    expect(CAMPAIGN.worlds.flatMap((w) => w.chapters.map((c) => c.title))).toEqual([
      "Moves",
      "Turns",
      "Detours",
      "Budgets",
      "Repeat",
      "Patterns",
      "Run to the wall",
      "Corridors",
      "Look",
      "Follow the wall",
      "Name it",
      "Parts",
    ]);
    expect(LEVELS).toHaveLength(52);
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
      const program = referenceOf(entry);
      const analysis = analyzeLevel(entry.level, program);
      expect(analysis.errors).toEqual([]);
      expect(analysis.referenceSolved).toBe(true);
      expect(simulate(entry.level, program as Program).status).toBe("SUCCEEDED");
      expect(entry.def.maxCommands).toBeGreaterThanOrEqual(analysis.par!.commands);
    },
  );

  it.each(built.map((b) => [b.def.slug, b] as const))(
    "%s offers only the commands it needs, and hints that fit",
    (_slug, entry) => {
      const used = new Set<string>();
      const walk = (node: { op: string; body?: unknown[]; then?: unknown[]; else?: unknown[] }) => {
        used.add(node.op === "CALL" ? "PROC" : node.op);
        for (const list of [node.body, node.then, node.else]) {
          for (const inner of (list ?? []) as (typeof node)[]) walk(inner);
        }
      };
      for (const node of referenceOf(entry) as Program) walk(node);
      // Every offered command is a real choice: the shortest program does not have to use all of
      // them, but none may be missing.
      for (const op of used) expect(entry.def.commands).toContain(op);
      // Each loop and decision belongs to its world: Repeat to world 3, Repeat until to worlds 4 and 5,
      // If to world 5, none of them earlier.
      const world = entry.world.title;
      expect(entry.def.commands.includes("REPEAT")).toBe(
        world === "Loops" || world === "Procedures",
      );
      expect(entry.def.commands.includes("REPEAT_UNTIL")).toBe(
        world === "Until" || world === "Decisions",
      );
      expect(entry.def.commands.includes("IF")).toBe(world === "Decisions");
      expect(entry.def.commands.includes("PROC")).toBe(world === "Procedures");
      expect(entry.def.hints?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(entry.def.hints?.length ?? 0).toBeLessThanOrEqual(3);
      for (const hint of entry.def.hints ?? []) expect(hint.length).toBeLessThanOrEqual(140);
    },
  );

  it("offers every movement command from the first level, and each loop only in its world", () => {
    const movement = ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"];
    const extra: Record<string, string[]> = {
      Loops: ["REPEAT"],
      Until: ["REPEAT_UNTIL"],
      Decisions: ["REPEAT_UNTIL", "IF"],
      Procedures: ["REPEAT", "PROC"],
    };
    for (const entry of built) {
      const expected = [...movement, ...(extra[entry.world.title] ?? [])];
      expect(entry.def.commands, entry.def.slug).toEqual(expected);
    }
  });

  it("gives the Budgets chapter and the loop worlds exactly the shortest program", () => {
    for (const entry of built) {
      const par = analyzeLevel(entry.level, referenceOf(entry)).par!.commands;
      const world = entry.world.title;
      const chapter = entry.chapterTitle;
      if (chapter === "Budgets" || !["Routes"].includes(world)) {
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
    { world: "Loops", ratio: 2, strip: ["REPEAT", "REPEAT_UNTIL"], uses: "REPEAT" },
    { world: "Until", ratio: 1.5, strip: ["REPEAT", "REPEAT_UNTIL"], uses: "REPEAT_UNTIL" },
    { world: "Decisions", ratio: 1.5, strip: ["IF"], uses: "IF" },
    { world: "Procedures", ratio: 1.3, strip: ["PROC"], uses: "PROC" },
  ];

  it.each(loopWorlds)("makes every $world level need its tool", ({ world, ratio, strip }) => {
    for (const entry of built.filter((b) => b.world.title === world)) {
      const plain = solve({
        ...entry.level,
        availableCommands: entry.level.availableCommands.filter((c) => !strip.includes(c)),
      })!;
      expect(plain.commands, entry.def.slug).toBeGreaterThan(entry.def.maxCommands);
      // The tool is not a marginal gain.
      expect(plain.commands, entry.def.slug).toBeGreaterThanOrEqual(ratio * entry.def.maxCommands);
    }
  });

  it.each(loopWorlds)(
    "solves every $world level with a program that uses its tool",
    ({ world, uses }) => {
      const has = (list: readonly unknown[]): boolean =>
        (list as { op: string; body?: unknown[] }[]).some(
          (node) => node.op === uses || (node.body ? has(node.body) : false),
        );
      for (const entry of built.filter((b) => b.world.title === world)) {
        expect(has(referenceOf(entry)), entry.def.slug).toBe(true);
      }
    },
  );

  it("gives every level with a reference solution step room for twice its run", () => {
    for (const entry of built.filter((b) => b.def.solution)) {
      const run = simulate(entry.level, referenceOf(entry) as Program);
      expect(run.steps * 2, entry.def.slug).toBeLessThanOrEqual(entry.level.constraints.maxSteps);
    }
  });
});
