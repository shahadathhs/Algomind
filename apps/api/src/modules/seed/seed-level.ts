import { randomUUID } from "node:crypto";
import { solve, type CommandName, type Direction, type Level } from "@algomind/level-contract";
import type { Prisma } from "../../generated/prisma/client.js";
import { analyzeLevel, contentHash } from "../levels/level-analysis.js";
import type { ValidationSummary } from "../levels/levels.schemas.js";

export const FACING: Record<string, Direction> = {
  "^": "north",
  ">": "east",
  v: "south",
  "<": "west",
};

/** A board from text rows: `.` floor, `#` wall, `G` target, `^ > v <` the automaton and its facing. */
export function readBoard(rows: readonly string[]) {
  const walls: [number, number][] = [];
  let goal: [number, number] | undefined;
  let start: { position: [number, number]; direction: Direction } | undefined;
  rows.forEach((row, y) => {
    Array.from(row).forEach((cell, x) => {
      if (cell === "#") walls.push([x, y]);
      else if (cell === "G") goal = [x, y];
      else if (cell in FACING) start = { position: [x, y], direction: FACING[cell]! };
    });
  });
  if (!goal || !start) throw new Error("A starter board needs a target and an automaton");
  return { width: rows[0]!.length, height: rows.length, walls, goal, start };
}

export type LevelDef = {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  commands: readonly CommandName[];
  maxCommands: number;
  rows: readonly string[];
  hints?: readonly string[];
};

/** The seed content failed the validator or solver: a bug in the data, never a runtime problem. */
export class SeedContentError extends Error {}

export function buildLevel(def: LevelDef, id: string): Level {
  const board = readBoard(def.rows);
  return {
    schemaVersion: 1,
    levelId: id,
    levelVersion: 1,
    slug: def.slug,
    title: def.title,
    description: "",
    difficulty: def.difficulty,
    requires: { mechanics: [] },
    board: { width: board.width, height: board.height, walls: board.walls },
    initialState: board.start,
    availableCommands: [...def.commands],
    constraints: { maxCommands: def.maxCommands, maxSteps: 100 },
    goal: { type: "reach_tile", position: board.goal },
    hints: [...(def.hints ?? [])],
  };
}

export type PreparedLevel = ReturnType<typeof prepareLevel>;

/** Validates a level and solves it with the solver; throws SeedContentError if either fails. */
export function prepareLevel(def: LevelDef) {
  const id = randomUUID();
  const level = buildLevel(def, id);
  const best = solve(level);
  if (!best) throw new SeedContentError(`Seed level ${def.slug} has no solution`);
  const analysis = analyzeLevel(level, best.program);
  if (analysis.errors.length > 0 || !analysis.referenceSolved || !analysis.par) {
    throw new SeedContentError(
      `Seed level ${def.slug} is invalid: ${JSON.stringify(analysis.errors)}`,
    );
  }
  return { def, id, level, program: best.program, analysis, par: analysis.par };
}

/**
 * Creates one published level with its version and a recorded "seed" playtest. `chapterId` is null
 * for a daily-pool level, which is published but not in the campaign.
 */
export async function createPublishedLevel(
  tx: Prisma.TransactionClient,
  item: PreparedLevel,
  placement: { chapterId: string | null; orderInChapter: number; dailyPool: boolean },
  note: string,
): Promise<void> {
  const { def, id, level, program, analysis, par } = item;
  const hash = contentHash(level);
  const now = new Date();
  const summary: ValidationSummary = {
    ok: true,
    errors: [],
    warnings: analysis.warnings,
    par,
    referenceSolved: true,
    requiredMechanics: analysis.requiredMechanics,
    contentHash: hash,
    validatedAt: now.toISOString(),
  };
  await tx.level.create({
    data: {
      id,
      slug: def.slug,
      title: def.title,
      difficulty: def.difficulty,
      status: "PUBLISHED",
      chapterId: placement.chapterId,
      orderInChapter: placement.orderInChapter,
      dailyPool: placement.dailyPool,
    },
  });
  const version = await tx.levelVersion.create({
    data: {
      levelId: id,
      versionNumber: 1,
      schemaVersion: 1,
      state: "PUBLISHED",
      content: level as unknown as Prisma.InputJsonObject,
      referenceSolution: program as unknown as Prisma.InputJsonArray,
      par,
      contentHash: hash,
      validationSummary: summary as unknown as Prisma.InputJsonObject,
      publishedAt: now,
    },
  });
  await tx.playtestRecord.create({
    data: {
      levelVersionId: version.id,
      contentHash: hash,
      testerName: "seed",
      solved: true,
      commandsUsed: par.commands,
      notes: note,
    },
  });
  await tx.level.update({ where: { id }, data: { currentPublishedVersionId: version.id } });
}
