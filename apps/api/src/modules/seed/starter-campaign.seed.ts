import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { solve, type CommandName, type Direction, type Level } from "@algomind/level-contract";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppConfig } from "../../core/config/app-config.js";
import { PrismaService } from "../../core/prisma/prisma.service.js";
import { analyzeLevel, contentHash } from "../levels/level-analysis.js";
import type { ValidationSummary } from "../levels/levels.schemas.js";
import { CAMPAIGN } from "./starter-campaign.data.js";

/** The app version the registry row describes: this package's version, which `make version` keeps current. */
const APP_VERSION: string = (
  JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

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

/** Every level with its place in the campaign, in play order. */
export const LEVELS = CAMPAIGN.worlds.flatMap((world) =>
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

/**
 * Creates the starter worlds, chapters, and published levels (see starter-campaign.data.ts) so a fresh install has a
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
