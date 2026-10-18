import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { solve, type Direction, type Level } from "@algomind/level-contract";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppConfig } from "../../core/config/app-config.js";
import { PrismaService } from "../../core/prisma/prisma.service.js";
import { analyzeLevel, contentHash } from "../levels/level-analysis.js";
import type { ValidationSummary } from "../levels/levels.schemas.js";

/** The app version the registry row describes: this package's version, which `make version` keeps current. */
const APP_VERSION: string = (
  JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

const FACING: Record<string, Direction> = { "^": "north", ">": "east", v: "south", "<": "west" };

/** A board from text rows: `.` floor, `#` wall, `G` target, `^ > v <` the automaton and its facing. */
function readBoard(rows: readonly string[]) {
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

// The starter campaign: four worlds, five chapters, nineteen levels, in play order. Each limit is
// at least the shortest possible program (the seed checks this with the solver and fails loudly
// otherwise), shrinking world by world until the last world allows exactly the shortest program.
const CAMPAIGN = [
  {
    title: "Sequences",
    description: "Instructions run in order, one after another.",
    chapters: [
      {
        title: "First steps",
        levels: [
          {
            slug: "straight-ahead",
            title: "Straight ahead",
            difficulty: "easy",
            maxCommands: 5,
            rows: [".....", "G....", ".....", ".....", "^...."],
            hints: ["Move forward until the automaton reaches the target."],
          },
          {
            slug: "all-the-way",
            title: "All the way",
            difficulty: "easy",
            maxCommands: 6,
            rows: ["G....", ".....", ".....", ".....", "^...."],
            hints: ["The target is straight ahead. How many cells away is it?"],
          },
          {
            slug: "along-the-floor",
            title: "Along the floor",
            difficulty: "easy",
            maxCommands: 6,
            rows: [".....", ".....", ".....", ".....", ">...G"],
            hints: ["The automaton faces east. Count the cells to the target."],
          },
          {
            slug: "mind-the-gap",
            title: "Mind the gap",
            difficulty: "easy",
            maxCommands: 6,
            rows: ["G....", ".#...", ".#...", ".#...", "^...."],
            hints: ["The walls are not in your way. Go straight."],
          },
        ],
      },
    ],
  },
  {
    title: "Turns",
    description: "Turn before you move to change where you are going.",
    chapters: [
      {
        title: "Corners",
        levels: [
          {
            slug: "one-turn",
            title: "One turn",
            difficulty: "easy",
            maxCommands: 8,
            rows: [".....", ".....", "...G.", ".....", "^...."],
            hints: ["Move up first, then turn toward the target."],
          },
          {
            slug: "turn-left",
            title: "Turn left",
            difficulty: "easy",
            maxCommands: 8,
            rows: [".....", "..G..", ".....", ".....", ">...."],
            hints: ["Turning left points the automaton up."],
          },
          {
            slug: "up-and-across",
            title: "Up and across",
            difficulty: "easy",
            maxCommands: 8,
            rows: [".....", "..G..", ".....", ".....", "^...."],
            hints: ["Move up to the target's row, then turn right."],
          },
          {
            slug: "turn-around",
            title: "Turn around",
            difficulty: "easy",
            maxCommands: 6,
            rows: [".....", ".....", "..^..", ".....", "..G.."],
            hints: ["The target is behind you. Turn twice, then move."],
          },
        ],
      },
      {
        title: "Around walls",
        levels: [
          {
            slug: "the-wall",
            title: "The wall",
            difficulty: "medium",
            maxCommands: 12,
            rows: [".....", ".....", ".#.G#", "..#..", "^#..."],
            hints: ["Look for a route around the wall."],
          },
          {
            slug: "two-walls",
            title: "Two walls",
            difficulty: "medium",
            maxCommands: 8,
            rows: [".....", ".#.#.", ".....", ".#.#.", "^...G"],
            hints: ["The walls leave gaps. Plan the path before you run."],
          },
          {
            slug: "the-detour",
            title: "The detour",
            difficulty: "medium",
            maxCommands: 11,
            rows: ["..#..", "..#G.", "..#..", "..#..", "^...."],
            hints: ["Go around the wall. There is only one gap."],
          },
          {
            slug: "long-way-round",
            title: "Long way round",
            difficulty: "hard",
            maxCommands: 18,
            rows: ["G....", "####.", ".....", ".####", "^...."],
            hints: ["Follow the corridor. Each wall opens at an end."],
          },
        ],
      },
    ],
  },
  {
    title: "Planning",
    description: "Look at the whole board first, then choose a route.",
    chapters: [
      {
        title: "Routes",
        levels: [
          {
            slug: "the-ring",
            title: "The ring",
            difficulty: "medium",
            maxCommands: 7,
            rows: [".....", ".#.#.", "..G..", ".#.#.", "^...."],
            hints: ["The target is in the middle. Pick a side and go around."],
          },
          {
            slug: "pick-a-side",
            title: "Pick a side",
            difficulty: "medium",
            maxCommands: 9,
            rows: ["..#..", ".....", "..#G.", ".....", "^.#.."],
            hints: ["Two routes work. One needs fewer commands."],
          },
          {
            slug: "switchback",
            title: "Switchback",
            difficulty: "hard",
            maxCommands: 12,
            rows: ["....G", "####.", ".....", ".####", "^...."],
            hints: ["Zigzag along the corridors. Each wall opens at the opposite end."],
          },
          {
            slug: "the-maze",
            title: "The maze",
            difficulty: "hard",
            maxCommands: 18,
            rows: ["..#G.", ".##..", "...#.", ".#...", "^.#.."],
            hints: ["Work backward from the target to find the route."],
          },
        ],
      },
    ],
  },
  {
    title: "Limits",
    description: "Solve it with exactly as many commands as it takes, no more.",
    chapters: [
      {
        title: "Tight budgets",
        levels: [
          {
            slug: "tight-corner",
            title: "Tight corner",
            difficulty: "medium",
            maxCommands: 5,
            rows: [".....", ".....", "..G..", ".....", ">...."],
            hints: ["You have very few commands. Count the turns carefully."],
          },
          {
            slug: "exactly-enough",
            title: "Exactly enough",
            difficulty: "hard",
            maxCommands: 6,
            rows: [".....", ".###.", ".#G#.", ".#.#.", "^...."],
            hints: ["The limit equals the shortest program. Every command counts."],
          },
          {
            slug: "no-wasted-moves",
            title: "No wasted moves",
            difficulty: "hard",
            maxCommands: 11,
            rows: ["..#.G", "..#..", "..#..", "....#", "^...."],
            hints: ["Plan the whole route first. There are no spare commands."],
          },
        ],
      },
    ],
  },
] as const;

type LevelDef = {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  maxCommands: number;
  rows: readonly string[];
  hints?: readonly string[];
};

/** Every level with its place in the campaign, in play order. */
const LEVELS = CAMPAIGN.flatMap((world) =>
  world.chapters.flatMap((chapter) =>
    (chapter.levels as readonly LevelDef[]).map((def, orderInChapter) => ({
      def,
      world: { title: world.title, description: world.description },
      chapterTitle: chapter.title,
      orderInChapter,
    })),
  ),
);

/** The starter content failed the validator or solver: a bug in this file, never a data problem. */
class SeedContentError extends Error {}

function buildLevel(def: LevelDef, id: string): Level {
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
    availableCommands: ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"],
    constraints: { maxCommands: def.maxCommands, maxSteps: 100 },
    goal: { type: "reach_tile", position: board.goal },
    hints: [...(def.hints ?? [])],
  };
}

/**
 * Creates the starter worlds, chapters, and nineteen published levels so a fresh install has a
 * playable campaign. Idempotent: anything that already exists (by slug, title) is left alone.
 * Controlled by SEED_STARTER_CAMPAIGN (default on outside production, off in production).
 */
@Injectable()
export class StarterCampaignSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(StarterCampaignSeed.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const mode = this.config.seedStarterCampaign;
    if (mode === "never") return;
    if (mode === "when-empty" && (await this.prisma.level.count()) > 0) return;
    try {
      await this.seed();
    } catch (error) {
      if (error instanceof SeedContentError || this.config.nodeEnv === "production") throw error;
      this.logger.warn(
        `Starter campaign seed skipped: ${error instanceof Error ? error.message : "failed"}`,
      );
    }
  }

  private async seed(): Promise<void> {
    await this.seedClientVersion();

    const existing = new Set(
      (
        await this.prisma.level.findMany({
          where: { slug: { in: LEVELS.map((l) => l.def.slug) } },
          select: { slug: true },
        })
      ).map((l) => l.slug),
    );
    const missing = LEVELS.filter((l) => !existing.has(l.def.slug));
    if (missing.length === 0) return;

    // Check everything before writing anything.
    const prepared = missing.map((entry) => {
      const { def } = entry;
      const id = randomUUID();
      const level = buildLevel(def, id);
      const best = solve(level);
      if (!best) throw new SeedContentError(`Starter level ${def.slug} has no solution`);
      const analysis = analyzeLevel(level, best.program);
      if (analysis.errors.length > 0 || !analysis.referenceSolved || !analysis.par) {
        throw new SeedContentError(
          `Starter level ${def.slug} is invalid: ${JSON.stringify(analysis.errors)}`,
        );
      }
      return { entry, def, id, level, program: best.program, analysis, par: analysis.par };
    });

    await this.prisma.$transaction(async (tx) => {
      const worlds = new Map<string, string>();
      const chapters = new Map<string, string>();
      const worldId = async (title: string, description: string): Promise<string> => {
        const known = worlds.get(title);
        if (known) return known;
        const world =
          (await tx.world.findFirst({ where: { title }, orderBy: { order: "asc" } })) ??
          (await tx.world.create({
            data: {
              title,
              description,
              order: ((await tx.world.aggregate({ _max: { order: true } }))._max.order ?? -1) + 1,
            },
          }));
        worlds.set(title, world.id);
        return world.id;
      };
      const chapterId = async (wid: string, title: string): Promise<string> => {
        const key = `${wid}/${title}`;
        const known = chapters.get(key);
        if (known) return known;
        const chapter =
          (await tx.chapter.findFirst({ where: { worldId: wid, title } })) ??
          (await tx.chapter.create({
            data: {
              title,
              worldId: wid,
              order:
                ((await tx.chapter.aggregate({ where: { worldId: wid }, _max: { order: true } }))
                  ._max.order ?? -1) + 1,
            },
          }));
        chapters.set(key, chapter.id);
        return chapter.id;
      };

      for (const item of prepared) {
        const { entry, def, id, level, program, analysis, par } = item;
        const wid = await worldId(entry.world.title, entry.world.description);
        const cid = await chapterId(wid, entry.chapterTitle);
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
            chapterId: cid,
            orderInChapter: entry.orderInChapter,
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
            notes: "Recorded by the starter campaign seed.",
          },
        });
        await tx.level.update({ where: { id }, data: { currentPublishedVersionId: version.id } });
      }
    });
    this.logger.log(
      `Created ${missing.length} starter level(s): ${missing.map((l) => l.def.slug).join(", ")}`,
    );
  }

  /** The registry row for this app version, supporting the three initial commands. */
  private async seedClientVersion(): Promise<void> {
    if (await this.prisma.clientVersion.findUnique({ where: { version: APP_VERSION } })) return;
    const hasMinimum = await this.prisma.clientVersion.findFirst({ where: { isMinimum: true } });
    await this.prisma.clientVersion.create({
      data: {
        version: APP_VERSION,
        supportedMechanics: ["move", "turn"],
        isMinimum: !hasMinimum,
      },
    });
    this.logger.log(`Registered app version ${APP_VERSION} in the client registry.`);
  }
}
