import { readFileSync } from "node:fs";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { AppConfig } from "../../core/config/app-config.js";
import { PrismaService } from "../../core/prisma/prisma.service.js";
import { DEFAULT_ACHIEVEMENTS } from "../achievements/default-achievements.js";
import { DAILY_POOL } from "./daily-pool.data.js";
import {
  SeedContentError,
  createPublishedLevel,
  prepareLevel,
  type LevelDef,
} from "./seed-level.js";
import { CAMPAIGN } from "./starter-campaign.data.js";

export { buildLevel, readBoard, type LevelDef } from "./seed-level.js";

/** The app version the registry row describes: this package's version, which `make version` keeps current. */
const APP_VERSION: string = (
  JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

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

/** The levels of the daily challenge pool: published, but not in the campaign. */
export const POOL_LEVELS = DAILY_POOL as readonly LevelDef[];

/**
 * Creates the starter worlds, chapters, and published levels (starter-campaign.data.ts), the daily
 * pool (daily-pool.data.ts), and the default badges, so a fresh install is a complete game.
 * Idempotent: anything that already exists (by slug, title) is left alone. Controlled by
 * SEED_STARTER_CAMPAIGN (default on outside production, off in production).
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
    await this.seedAchievements();
    await this.seedCampaign();
    await this.seedPool();
  }

  private async missing<T extends { slug: string }>(wanted: readonly T[]): Promise<T[]> {
    const existing = new Set(
      (
        await this.prisma.level.findMany({
          where: { slug: { in: wanted.map((w) => w.slug) } },
          select: { slug: true },
        })
      ).map((l) => l.slug),
    );
    return wanted.filter((w) => !existing.has(w.slug));
  }

  private async seedCampaign(): Promise<void> {
    const missingSlugs = new Set((await this.missing(LEVELS.map((l) => l.def))).map((d) => d.slug));
    const missing = LEVELS.filter((l) => missingSlugs.has(l.def.slug));
    if (missing.length === 0) return;
    // Check everything before writing anything.
    const prepared = missing.map((entry) => ({ entry, item: prepareLevel(entry.def) }));

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

      for (const { entry, item } of prepared) {
        const wid = await worldId(entry.world.title, entry.world.description);
        const cid = await chapterId(wid, entry.chapterTitle);
        await createPublishedLevel(
          tx,
          item,
          { chapterId: cid, orderInChapter: entry.orderInChapter, dailyPool: false },
          "Recorded by the starter campaign seed.",
        );
      }
    });
    this.logger.log(
      `Created ${missing.length} starter level(s): ${missing.map((l) => l.def.slug).join(", ")}`,
    );
  }

  /** The daily pool: published levels with no chapter, so players meet them only on their day. */
  private async seedPool(): Promise<void> {
    const missing = await this.missing(POOL_LEVELS);
    if (missing.length === 0) return;
    const prepared = missing.map((def) => prepareLevel(def));
    await this.prisma.$transaction(async (tx) => {
      for (const item of prepared) {
        await createPublishedLevel(
          tx,
          item,
          { chapterId: null, orderInChapter: 0, dailyPool: true },
          "Recorded by the daily pool seed.",
        );
      }
    });
    this.logger.log(`Created ${missing.length} daily pool level(s).`);
  }

  /** The default badges, only on a database that has none: later edits in the dashboard stay. */
  private async seedAchievements(): Promise<void> {
    if ((await this.prisma.achievement.count()) > 0) return;
    await this.prisma.achievement.createMany({
      data: DEFAULT_ACHIEVEMENTS.map((badge, position) => ({
        slug: badge.slug,
        title: badge.title,
        description: badge.description,
        rule: badge.rule as unknown as object,
        position,
      })),
    });
    this.logger.log(`Created ${DEFAULT_ACHIEVEMENTS.length} default badges.`);
  }

  /** The registry row for this app version, supporting the three initial commands. */
  private async seedClientVersion(): Promise<void> {
    if (await this.prisma.clientVersion.findUnique({ where: { version: APP_VERSION } })) return;
    const hasMinimum = await this.prisma.clientVersion.findFirst({ where: { isMinimum: true } });
    await this.prisma.clientVersion.create({
      data: {
        version: APP_VERSION,
        supportedMechanics: [
          "move",
          "turn",
          "repeat",
          "repeat_until",
          "if",
          "procedures",
          "counter",
          "markers",
          "nested_loops",
          "visit_all",
          "multi_board",
        ],
        isMinimum: !hasMinimum,
      },
    });
    this.logger.log(`Registered app version ${APP_VERSION} in the client registry.`);
  }
}
