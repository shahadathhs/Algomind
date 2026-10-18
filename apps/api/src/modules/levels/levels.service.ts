import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { DIFFICULTIES, ID_PATTERN, SCHEMA_VERSION } from "@algomind/level-contract";
import { Prisma } from "../../generated/prisma/client.js";
import type { Level, LevelVersion } from "../../generated/prisma/client.js";
import { conflict, isUniqueViolation, notFound, unprocessable } from "../../core/http/errors.js";
import { PrismaService } from "../../core/prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { ClientVersionsService } from "../client-versions/client-versions.service.js";
import { analyzeLevel, contentHash, failedGates, type Analysis } from "./level-analysis.js";
import {
  jsonOrNull,
  loadPlaytestFacts,
  SUMMARY_INCLUDE,
  toLevelSummary,
  toPlaytestView,
  toVersionSummary,
  toVersionView,
} from "./level-views.js";
import type {
  CreateLevel,
  ExportEnvelope,
  LevelPage,
  LevelView,
  ListLevelsQuery,
  PlaytestBody,
  PlaytestView,
  UpdateDraft,
  ValidateResponse,
  ValidationSummary,
  VersionSummary,
  VersionView,
} from "./levels.schemas.js";

type Db = Prisma.TransactionClient;
type Json = Record<string, unknown>;

const SLUG_PATTERN = new RegExp(ID_PATTERN);

/** The server owns the identity fields of a version: level id, version number, and slug. */
function stamp(content: Json, level: { id: string; slug: string }, versionNumber: number): Json {
  return { ...content, levelId: level.id, levelVersion: versionNumber, slug: level.slug };
}

function starterContent(title: string, difficulty: string): Json {
  return {
    schemaVersion: SCHEMA_VERSION,
    title,
    description: "",
    difficulty,
    requires: { mechanics: [] },
    board: { width: 5, height: 5, walls: [] },
    initialState: { position: [0, 4], direction: "north" },
    availableCommands: ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"],
    constraints: { maxCommands: 10, maxSteps: 30 },
    goal: { type: "reach_tile", position: [4, 0] },
    hints: [],
  };
}

function schemaVersionOf(content: Json): number {
  return Number.isInteger(content.schemaVersion)
    ? (content.schemaVersion as number)
    : SCHEMA_VERSION;
}

/** Title and difficulty mirrored on the level row, when the content carries usable values. */
function mirrored(content: Json, level: Pick<Level, "title" | "difficulty">) {
  const title = content.title;
  const difficulty = content.difficulty;
  return {
    title:
      typeof title === "string" && title.length >= 1 && Array.from(title).length <= 60
        ? title
        : level.title,
    difficulty:
      typeof difficulty === "string" && (DIFFICULTIES as readonly string[]).includes(difficulty)
        ? difficulty
        : level.difficulty,
  };
}

@Injectable()
export class LevelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clients: ClientVersionsService,
  ) {}

  // ---- reading -----------------------------------------------------------------------------

  async list(query: ListLevelsQuery): Promise<LevelPage> {
    const and: Prisma.LevelWhereInput[] = [];
    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { slug: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }
    if (query.status) and.push({ status: query.status });
    if (query.difficulty) and.push({ difficulty: query.difficulty });
    if (query.chapterId) and.push({ chapterId: query.chapterId });
    if (query.worldId) and.push({ chapter: { worldId: query.worldId } });
    if (query.unassigned)
      and.push(query.unassigned === "true" ? { chapterId: null } : { chapterId: { not: null } });
    if (query.hasDraft) {
      and.push(
        query.hasDraft === "true"
          ? { versions: { some: { state: "DRAFT" } } }
          : { versions: { none: { state: "DRAFT" } } },
      );
    }
    const where: Prisma.LevelWhereInput = and.length ? { AND: and } : {};
    const [total, rows] = await Promise.all([
      this.prisma.level.count({ where }),
      this.prisma.level.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: [{ [query.sort]: query.order }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const facts = await loadPlaytestFacts(
      this.prisma,
      rows.map((r) => r.id),
    );
    return {
      items: rows.map((r) => toLevelSummary(r, facts)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string, db: Db = this.prisma): Promise<LevelView> {
    const row = await db.level.findUnique({ where: { id }, include: SUMMARY_INCLUDE });
    if (!row) throw notFound("The level");
    const [draft, published, records] = await Promise.all([
      db.levelVersion.findFirst({ where: { levelId: id, state: "DRAFT" } }),
      row.currentPublishedVersionId
        ? db.levelVersion.findUnique({ where: { id: row.currentPublishedVersionId } })
        : null,
      db.playtestRecord.findMany({
        where: { levelVersion: { levelId: id } },
        select: { contentHash: true, solved: true },
      }),
    ]);
    const facts = records.map((r) => ({ levelId: id, ...r }));
    return {
      ...toLevelSummary(row, facts),
      currentPublishedVersionId: row.currentPublishedVersionId,
      draft: draft ? toVersionView(draft) : null,
      published: published ? toVersionView(published) : null,
      playtests: {
        count: records.length,
        solvedForCurrentContent:
          !!draft && records.some((r) => r.solved && r.contentHash === draft.contentHash),
      },
    };
  }

  async versions(id: string): Promise<{ items: VersionSummary[] }> {
    await this.requireLevel(this.prisma, id);
    const rows = await this.prisma.levelVersion.findMany({
      where: { levelId: id },
      orderBy: { versionNumber: "desc" },
    });
    return { items: rows.map(toVersionSummary) };
  }

  async version(id: string, versionId: string): Promise<VersionView> {
    const row = await this.prisma.levelVersion.findFirst({ where: { id: versionId, levelId: id } });
    if (!row) throw notFound("The version");
    return toVersionView(row);
  }

  private async requireLevel(db: Db, id: string): Promise<Level> {
    const level = await db.level.findUnique({ where: { id } });
    if (!level) throw notFound("The level");
    return level;
  }

  private async requireDraft(db: Db, levelId: string): Promise<LevelVersion> {
    const draft = await db.levelVersion.findFirst({ where: { levelId, state: "DRAFT" } });
    if (!draft) {
      throw conflict(
        "NO_DRAFT",
        "The level has no draft. Create one from the current version first.",
      );
    }
    return draft;
  }

  /** Serializes publishing, unpublishing and draft creation for one level. */
  private async lock(tx: Db, id: string): Promise<void> {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Level" WHERE "id" = ${id} FOR UPDATE`;
    if (rows.length === 0) throw notFound("The level");
  }

  // ---- drafts ------------------------------------------------------------------------------

  async create(input: CreateLevel, userId: string): Promise<LevelView> {
    const id = randomUUID();
    const base = { ...starterContent(input.title, input.difficulty), ...input.content };
    const content = stamp({ ...base, title: input.title }, { id, slug: input.slug }, 1);
    const referenceSolution = input.referenceSolution ?? [];
    try {
      await this.prisma.$transaction(async (tx) => {
        const level = await tx.level.create({
          data: {
            id,
            slug: input.slug,
            title: input.title,
            difficulty: input.difficulty,
            createdBy: userId,
            updatedBy: userId,
          },
        });
        await tx.levelVersion.create({
          data: {
            levelId: level.id,
            versionNumber: 1,
            schemaVersion: schemaVersionOf(content),
            content: content as Prisma.InputJsonObject,
            referenceSolution: referenceSolution as Prisma.InputJsonArray,
            contentHash: contentHash(content),
            createdBy: userId,
          },
        });
        await tx.level.update({
          where: { id },
          data: mirrored(content, level),
        });
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict("SLUG_TAKEN", `The slug "${input.slug}" is already used.`);
      throw error;
    }
    return this.get(id);
  }

  async saveDraft(id: string, input: UpdateDraft, userId: string): Promise<LevelView> {
    const expected = new Date(input.expectedUpdatedAt);
    try {
      await this.prisma.$transaction(async (tx) => {
        const level = await this.requireLevel(tx, id);
        const draft = await this.requireDraft(tx, id);
        if (draft.updatedAt.getTime() !== expected.getTime()) {
          throw conflict(
            "DRAFT_CONFLICT",
            "The draft was changed since you loaded it. Reload to see the latest version.",
          );
        }
        const incoming = (input.content ?? (draft.content as Json)) as Json;
        const requested = incoming.slug;
        let slugValue = level.slug;
        if (typeof requested === "string" && requested !== level.slug) {
          if (SLUG_PATTERN.test(requested) && requested.length <= 64) {
            const everPublished = await tx.levelVersion.count({
              where: { levelId: id, state: { in: ["PUBLISHED", "SUPERSEDED"] } },
            });
            if (everPublished > 0) {
              throw unprocessable("SLUG_LOCKED", "The slug of a published level cannot change.", [
                {
                  path: "content.slug",
                  code: "SLUG_LOCKED",
                  message: "The slug of a level that has been published cannot change.",
                },
              ]);
            }
            slugValue = requested;
          }
        }
        const content = stamp({ ...incoming }, { id, slug: slugValue }, draft.versionNumber);
        // An invalid slug typed by the author stays visible to validate.
        if (typeof requested === "string" && !SLUG_PATTERN.test(requested))
          content.slug = requested;
        const written = await tx.levelVersion.updateMany({
          where: { id: draft.id, state: "DRAFT", updatedAt: expected },
          data: {
            schemaVersion: schemaVersionOf(content),
            content: content as Prisma.InputJsonObject,
            referenceSolution: (input.referenceSolution ??
              (draft.referenceSolution as unknown[])) as Prisma.InputJsonArray,
            contentHash: contentHash(content),
            par: Prisma.DbNull,
            validationSummary: Prisma.DbNull,
          },
        });
        if (written.count === 0) {
          throw conflict("DRAFT_CONFLICT", "The draft was changed since you loaded it.");
        }
        await tx.level.update({
          where: { id },
          data: { slug: slugValue, updatedBy: userId, ...mirrored(content, level) },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict("SLUG_TAKEN", "That slug is already used by another level.");
      throw error;
    }
    return this.get(id);
  }

  /** Starts a new draft from a published or earlier version. */
  private async startDraft(
    tx: Db,
    level: Level,
    source: LevelVersion,
    userId: string,
  ): Promise<LevelVersion> {
    if (await tx.levelVersion.findFirst({ where: { levelId: level.id, state: "DRAFT" } })) {
      throw conflict("DRAFT_EXISTS", "The level already has a draft. Discard it first.");
    }
    const latest = await tx.levelVersion.aggregate({
      where: { levelId: level.id },
      _max: { versionNumber: true },
    });
    const versionNumber = (latest._max.versionNumber ?? 0) + 1;
    const content = stamp(source.content as Json, level, versionNumber);
    try {
      return await tx.levelVersion.create({
        data: {
          levelId: level.id,
          versionNumber,
          schemaVersion: source.schemaVersion,
          content: content as Prisma.InputJsonObject,
          referenceSolution: source.referenceSolution as Prisma.InputJsonArray,
          contentHash: contentHash(content),
          createdBy: userId,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict("DRAFT_EXISTS", "The level already has a draft.");
      throw error;
    }
  }

  async createDraft(id: string, userId: string): Promise<LevelView> {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const level = await this.requireLevel(tx, id);
      const source =
        (level.currentPublishedVersionId
          ? await tx.levelVersion.findUnique({ where: { id: level.currentPublishedVersionId } })
          : null) ??
        (await tx.levelVersion.findFirst({
          where: { levelId: id },
          orderBy: { versionNumber: "desc" },
        }));
      if (!source) throw conflict("NO_VERSION", "The level has no version to copy.");
      await this.startDraft(tx, level, source, userId);
      await tx.level.update({ where: { id }, data: { updatedBy: userId } });
    });
    return this.get(id);
  }

  async restore(id: string, versionId: string, userId: string): Promise<LevelView> {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const level = await this.requireLevel(tx, id);
      const source = await tx.levelVersion.findFirst({ where: { id: versionId, levelId: id } });
      if (!source) throw notFound("The version");
      const draft = await this.startDraft(tx, level, source, userId);
      await tx.level.update({
        where: { id },
        data: { updatedBy: userId, ...mirrored(draft.content as Json, level) },
      });
      await this.audit.record(tx, {
        userId,
        action: "LEVEL_RESTORED",
        entityType: "level",
        entityId: id,
        detail: {
          slug: level.slug,
          restoredVersionId: source.id,
          restoredVersionNumber: source.versionNumber,
          newDraftVersionNumber: draft.versionNumber,
        },
      });
    });
    return this.get(id);
  }

  async discardDraft(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const draft = await this.requireDraft(tx, id);
      const history = await tx.levelVersion.count({
        where: { levelId: id, state: { in: ["PUBLISHED", "SUPERSEDED"] } },
      });
      if (history === 0) {
        throw conflict(
          "NEVER_PUBLISHED",
          "A level that was never published has no earlier version; delete the level instead.",
        );
      }
      await tx.levelVersion.delete({ where: { id: draft.id } });
      const remaining = await tx.levelVersion.findFirst({
        where: { levelId: id },
        orderBy: { versionNumber: "desc" },
      });
      const level = await this.requireLevel(tx, id);
      if (remaining) {
        await tx.level.update({ where: { id }, data: mirrored(remaining.content as Json, level) });
      }
    });
  }

  async deleteLevel(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const history = await tx.levelVersion.count({
        where: { levelId: id, state: { in: ["PUBLISHED", "SUPERSEDED"] } },
      });
      if (history > 0) {
        throw conflict(
          "HAS_HISTORY",
          "A level that has been published cannot be deleted. Unpublish and archive it instead.",
        );
      }
      await tx.level.delete({ where: { id } });
    });
  }

  async duplicate(
    id: string,
    input: { slug?: string; title?: string },
    userId: string,
  ): Promise<LevelView> {
    const source = await this.requireLevel(this.prisma, id);
    const version =
      (await this.prisma.levelVersion.findFirst({ where: { levelId: id, state: "DRAFT" } })) ??
      (source.currentPublishedVersionId
        ? await this.prisma.levelVersion.findUnique({
            where: { id: source.currentPublishedVersionId },
          })
        : null) ??
      (await this.prisma.levelVersion.findFirst({
        where: { levelId: id },
        orderBy: { versionNumber: "desc" },
      }));
    if (!version) throw conflict("NO_VERSION", "The level has no version to copy.");

    let slug = input.slug;
    if (!slug) {
      const root = `${source.slug}-copy`.slice(0, 60);
      slug = root;
      for (let n = 2; await this.prisma.level.findUnique({ where: { slug } }); n += 1) {
        slug = `${root}-${n}`;
      }
    }
    const title = input.title ?? `${source.title} copy`.slice(0, 60);
    const newId = randomUUID();
    const content = stamp({ ...(version.content as Json), title }, { id: newId, slug }, 1);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.level.create({
          data: {
            id: newId,
            slug,
            title,
            difficulty: mirrored(content, source).difficulty,
            createdBy: userId,
            updatedBy: userId,
          },
        });
        await tx.levelVersion.create({
          data: {
            levelId: newId,
            versionNumber: 1,
            schemaVersion: version.schemaVersion,
            content: content as Prisma.InputJsonObject,
            referenceSolution: version.referenceSolution as Prisma.InputJsonArray,
            contentHash: contentHash(content),
            createdBy: userId,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict("SLUG_TAKEN", `The slug "${slug}" is already used.`);
      throw error;
    }
    return this.get(newId);
  }

  // ---- validation and publishing -----------------------------------------------------------

  private async evaluate(db: Db, level: Level, draft: LevelVersion) {
    const analysis: Analysis = analyzeLevel(draft.content, draft.referenceSolution);
    const hash = contentHash(draft.content);
    const [records, minimum, registry] = await Promise.all([
      db.playtestRecord.findMany({
        where: { levelVersion: { levelId: level.id } },
        select: { contentHash: true, solved: true },
      }),
      this.clients.minimum(),
      this.clients.all(),
    ]);
    const solvedForCurrentContent = records.some((r) => r.solved && r.contentHash === hash);
    const failed = failedGates({
      analysis,
      hasSolvedPlaytest: solvedForCurrentContent,
      chapterId: level.chapterId,
      minimum,
      registry,
    });
    const summary: ValidationSummary = {
      ok: analysis.errors.length === 0,
      errors: analysis.errors,
      warnings: analysis.warnings,
      par: analysis.par,
      referenceSolved: analysis.referenceSolved,
      requiredMechanics: analysis.requiredMechanics,
      contentHash: hash,
      validatedAt: new Date().toISOString(),
    };
    const unsupported = minimum
      ? analysis.requiredMechanics.filter((m) => !minimum.supportedMechanics.includes(m))
      : [];
    return {
      analysis,
      summary,
      failed,
      playtests: { count: records.length, solvedForCurrentContent },
      compatibility: {
        minimumVersion: minimum?.version ?? null,
        unsupportedMechanics: unsupported,
      },
    };
  }

  async validate(id: string): Promise<ValidateResponse> {
    const level = await this.requireLevel(this.prisma, id);
    const draft = await this.requireDraft(this.prisma, id);
    const result = await this.evaluate(this.prisma, level, draft);
    // Keep the result with the draft without moving its updatedAt (the editor's save token). A
    // save that raced this call wins: the write only applies to the exact row state we read.
    await this.prisma.levelVersion.updateMany({
      where: { id: draft.id, state: "DRAFT", updatedAt: draft.updatedAt },
      data: {
        par: jsonOrNull(result.analysis.par),
        validationSummary: result.summary as unknown as Prisma.InputJsonObject,
        updatedAt: draft.updatedAt,
      },
    });
    return {
      ...result.summary,
      publish: { ready: result.failed.length === 0, failedGates: result.failed },
      playtests: result.playtests,
      compatibility: result.compatibility,
    };
  }

  async publish(
    id: string,
    userId: string,
  ): Promise<{ level: LevelView; publishedVersionId: string }> {
    const publishedVersionId = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const level = await this.requireLevel(tx, id);
      const draft = await this.requireDraft(tx, id);
      const result = await this.evaluate(tx, level, draft);
      if (result.failed.length > 0) {
        throw unprocessable(
          "PUBLISH_BLOCKED",
          `The level cannot be published: ${result.failed.length} check${result.failed.length === 1 ? "" : "s"} failed.`,
          result.failed,
        );
      }
      const previous = await tx.levelVersion.findFirst({
        where: { levelId: id, state: "PUBLISHED" },
      });
      if (previous) {
        await tx.levelVersion.update({ where: { id: previous.id }, data: { state: "SUPERSEDED" } });
      }
      const now = new Date();
      await tx.levelVersion.update({
        where: { id: draft.id },
        data: {
          state: "PUBLISHED",
          publishedAt: now,
          par: result.analysis.par as Prisma.InputJsonObject,
          validationSummary: result.summary as unknown as Prisma.InputJsonObject,
        },
      });
      await tx.level.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          currentPublishedVersionId: draft.id,
          updatedBy: userId,
          ...mirrored(draft.content as Json, level),
        },
      });
      await this.audit.record(tx, {
        userId,
        action: "LEVEL_PUBLISHED",
        entityType: "level",
        entityId: id,
        detail: {
          slug: level.slug,
          versionId: draft.id,
          versionNumber: draft.versionNumber,
          supersededVersionNumber: previous?.versionNumber ?? null,
          par: result.analysis.par as Prisma.InputJsonObject,
        },
      });
      return draft.id;
    });
    return { level: await this.get(id), publishedVersionId };
  }

  async unpublish(id: string, archive: boolean, userId: string): Promise<LevelView> {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const level = await this.requireLevel(tx, id);
      if (!level.currentPublishedVersionId) {
        throw conflict("NOT_PUBLISHED", "The level is not published.");
      }
      const version = await tx.levelVersion.update({
        where: { id: level.currentPublishedVersionId },
        data: { state: "SUPERSEDED" },
      });
      await tx.level.update({
        where: { id },
        data: {
          currentPublishedVersionId: null,
          status: archive ? "ARCHIVED" : "DRAFT",
          updatedBy: userId,
        },
      });
      const detail = {
        slug: level.slug,
        versionId: version.id,
        versionNumber: version.versionNumber,
      };
      await this.audit.record(tx, {
        userId,
        action: "LEVEL_UNPUBLISHED",
        entityType: "level",
        entityId: id,
        detail,
      });
      if (archive) {
        await this.audit.record(tx, {
          userId,
          action: "LEVEL_ARCHIVED",
          entityType: "level",
          entityId: id,
          detail,
        });
      }
    });
    return this.get(id);
  }

  // ---- playtests ---------------------------------------------------------------------------

  async createPlaytest(id: string, input: PlaytestBody, userId: string): Promise<PlaytestView> {
    await this.requireLevel(this.prisma, id);
    const draft = await this.requireDraft(this.prisma, id);
    const row = await this.prisma.playtestRecord.create({
      data: {
        levelVersionId: draft.id,
        contentHash: contentHash(draft.content),
        testerName: input.testerName,
        solved: input.solved,
        commandsUsed: input.commandsUsed ?? null,
        perceivedDifficulty: input.perceivedDifficulty ?? null,
        notes: input.notes,
        createdBy: userId,
      },
      include: { levelVersion: { select: { versionNumber: true } } },
    });
    return toPlaytestView(row, row.contentHash);
  }

  async listPlaytests(id: string): Promise<{ items: PlaytestView[] }> {
    await this.requireLevel(this.prisma, id);
    const level = await this.prisma.level.findUnique({
      where: { id },
      select: { currentPublishedVersionId: true },
    });
    const reference =
      (await this.prisma.levelVersion.findFirst({ where: { levelId: id, state: "DRAFT" } })) ??
      (level?.currentPublishedVersionId
        ? await this.prisma.levelVersion.findUnique({
            where: { id: level.currentPublishedVersionId },
          })
        : null);
    const rows = await this.prisma.playtestRecord.findMany({
      where: { levelVersion: { levelId: id } },
      orderBy: { createdAt: "desc" },
      include: { levelVersion: { select: { versionNumber: true } } },
    });
    return { items: rows.map((r) => toPlaytestView(r, reference?.contentHash ?? null)) };
  }

  // ---- export and import -------------------------------------------------------------------

  async export(id: string, versionId?: string): Promise<ExportEnvelope> {
    const level = await this.requireLevel(this.prisma, id);
    const version = versionId
      ? await this.prisma.levelVersion.findFirst({ where: { id: versionId, levelId: id } })
      : ((await this.prisma.levelVersion.findFirst({ where: { levelId: id, state: "DRAFT" } })) ??
        (level.currentPublishedVersionId
          ? await this.prisma.levelVersion.findUnique({
              where: { id: level.currentPublishedVersionId },
            })
          : null) ??
        (await this.prisma.levelVersion.findFirst({
          where: { levelId: id },
          orderBy: { versionNumber: "desc" },
        })));
    if (!version) throw notFound("The version");
    const analysis = analyzeLevel(version.content, version.referenceSolution);
    if (analysis.errors.length > 0) {
      throw unprocessable(
        "LEVEL_VALIDATION_FAILED",
        "Only a valid level can be exported.",
        analysis.errors,
      );
    }
    const content = version.content as Json;
    return {
      format: "algomind-level",
      schemaVersion: schemaVersionOf(content),
      exportedAt: new Date().toISOString(),
      meta: { title: String(content.title), slug: String(content.slug) },
      level: content,
      referenceSolution: version.referenceSolution as unknown[],
    };
  }

  async import(
    envelope: { schemaVersion: number; level: Json; referenceSolution: unknown[] },
    slugOverride: string | undefined,
    userId: string,
  ): Promise<LevelView> {
    if (envelope.schemaVersion !== SCHEMA_VERSION) {
      throw unprocessable(
        "UNSUPPORTED_SCHEMA_VERSION",
        `This API reads schema version ${SCHEMA_VERSION}; the file has ${envelope.schemaVersion}.`,
        [
          {
            path: "schemaVersion",
            code: "UNSUPPORTED_SCHEMA_VERSION",
            message: `Only schema version ${SCHEMA_VERSION} is supported.`,
          },
        ],
      );
    }
    const slug = slugOverride ?? envelope.level.slug;
    if (typeof slug === "string" && (await this.prisma.level.findUnique({ where: { slug } }))) {
      throw conflict(
        "SLUG_TAKEN",
        `A level with the slug "${slug}" already exists. Import again with a different slug.`,
      );
    }
    const id = randomUUID();
    const content = stamp(
      { ...envelope.level },
      { id, slug: typeof slug === "string" ? slug : "" },
      1,
    );
    const analysis = analyzeLevel(content, envelope.referenceSolution);
    if (analysis.errors.length > 0) {
      throw unprocessable(
        "LEVEL_VALIDATION_FAILED",
        "The file does not contain a valid level.",
        analysis.errors,
      );
    }
    const level = analysis.level!;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.level.create({
          data: {
            id,
            slug: level.slug,
            title: level.title,
            difficulty: level.difficulty,
            createdBy: userId,
            updatedBy: userId,
          },
        });
        await tx.levelVersion.create({
          data: {
            levelId: id,
            versionNumber: 1,
            schemaVersion: level.schemaVersion,
            content: content as Prisma.InputJsonObject,
            referenceSolution: envelope.referenceSolution as Prisma.InputJsonArray,
            contentHash: contentHash(content),
            createdBy: userId,
          },
        });
        await this.audit.record(tx, {
          userId,
          action: "LEVEL_IMPORTED",
          entityType: "level",
          entityId: id,
          detail: { slug: level.slug, title: level.title },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("SLUG_TAKEN", `A level with the slug "${level.slug}" already exists.`);
      }
      throw error;
    }
    return this.get(id);
  }
}
