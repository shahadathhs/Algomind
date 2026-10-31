import { apiBaseUrl } from "@/lib/api";
import { type BoardData, type Dir, tilesOf } from "@/lib/board";

/**
 * The published campaign as the public site shows it: worlds, chapters inside a world, and levels
 * inside a chapter, in play order. It is read from the API (`GET /v1/campaign`, then each level's
 * board from `GET /v1/levels/:slug`), so a level appears here the moment it is published from the
 * dashboard. Nothing is bundled: when the API cannot be reached the page says so.
 */
export type Difficulty = "easy" | "medium" | "hard";

export type CampaignLevel = {
  slug: string;
  /** Position in the whole campaign, from 1. */
  number: number;
  title: string;
  difficulty: Difficulty;
  /** The command limit shown to players. */
  maxCommands: number;
  board: BoardData;
  /** How many boards one program must solve (1 unless the level has test boards). */
  boardCount: number;
};

export type Chapter = { id: string; title: string; levels: CampaignLevel[] };

export type World = {
  id: string;
  number: number;
  title: string;
  summary: string;
  chapters: Chapter[];
};

export type CampaignState = { status: "available"; worlds: World[] } | { status: "unavailable" };

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const REVALIDATE_SECONDS = 60;
const FETCH_TIMEOUT_MS = 8000;
const DIRECTION: Record<string, Dir> = { north: "N", east: "E", south: "S", west: "W" };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function point(value: unknown): { x: number; y: number } | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value as unknown[];
  return Number.isInteger(x) && Number.isInteger(y) ? { x: x as number, y: y as number } : null;
}

/** The renderer's board for a published level's content, or null when the content is malformed. */
export function boardFromContent(content: unknown): BoardData | null {
  if (!isObject(content) || !isObject(content.board) || !isObject(content.initialState))
    return null;
  if (!isObject(content.goal)) return null;
  const { width, height, walls } = content.board;
  if (!Number.isInteger(width) || !Number.isInteger(height) || !Array.isArray(walls)) return null;
  const start = point(content.initialState.position);
  const dir = DIRECTION[String(content.initialState.direction)];
  // A sweep board (visit_all) has no target; any other goal needs a position.
  const sweep = content.goal.type === "visit_all";
  const goal = sweep ? undefined : (point(content.goal.position) ?? undefined);
  const wallPoints = walls.map(point);
  if (!start || !dir || (!sweep && !goal) || wallPoints.some((p) => p === null)) return null;
  return {
    width: width as number,
    height: height as number,
    walls: wallPoints as { x: number; y: number }[],
    goal,
    automaton: { ...start, dir },
    ...tilesOf(content),
  };
}

export async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.json();
}

function difficultyOf(value: unknown): Difficulty {
  return value === "medium" || value === "hard" ? value : "easy";
}

/** The campaign shown on the site. Never throws; `unavailable` covers any failure or bad data. */
export async function getCampaign(): Promise<CampaignState> {
  try {
    const catalog = await getJson("/campaign");
    if (!isObject(catalog) || !Array.isArray(catalog.worlds)) return { status: "unavailable" };

    const entries: {
      slug: string;
      number: number;
      title: string;
      difficulty: Difficulty;
      maxCommands: number;
    }[] = [];
    for (const world of catalog.worlds as unknown[]) {
      if (!isObject(world) || !Array.isArray(world.chapters)) return { status: "unavailable" };
      for (const chapter of world.chapters as unknown[]) {
        if (!isObject(chapter) || !Array.isArray(chapter.levels)) return { status: "unavailable" };
        for (const level of chapter.levels as unknown[]) {
          if (!isObject(level) || typeof level.slug !== "string") return { status: "unavailable" };
          entries.push({
            slug: level.slug,
            number: entries.length + 1,
            title: String(level.title),
            difficulty: difficultyOf(level.difficulty),
            maxCommands: Number(level.maxCommands),
          });
        }
      }
    }

    const boards = new Map<string, BoardData>();
    const boardCounts = new Map<string, number>();
    await Promise.all(
      entries.map(async (entry) => {
        const detail = await getJson(`/levels/${encodeURIComponent(entry.slug)}`);
        const board = isObject(detail) ? boardFromContent(detail.content) : null;
        if (!board) throw new Error(`Level ${entry.slug} has no readable board`);
        boards.set(entry.slug, board);
        const extra =
          isObject(detail) && isObject(detail.content) ? detail.content.extraBoards : null;
        boardCounts.set(entry.slug, 1 + (Array.isArray(extra) ? extra.length : 0));
      }),
    );

    const byNumber = new Map(entries.map((e) => [e.slug, e]));
    const worlds: World[] = (catalog.worlds as Json[]).map((world, wi) => ({
      id: String(world.id),
      number: wi + 1,
      title: String(world.title),
      summary: typeof world.description === "string" ? world.description : "",
      chapters: (world.chapters as Json[]).map((chapter) => ({
        id: String(chapter.id),
        title: String(chapter.title),
        levels: (chapter.levels as Json[]).map((level): CampaignLevel => {
          const entry = byNumber.get(String(level.slug))!;
          return {
            ...entry,
            board: boards.get(entry.slug)!,
            boardCount: boardCounts.get(entry.slug) ?? 1,
          };
        }),
      })),
    }));
    return { status: "available", worlds };
  } catch {
    return { status: "unavailable" };
  }
}

export function levelCount(world: World): number {
  return world.chapters.reduce((total, chapter) => total + chapter.levels.length, 0);
}
