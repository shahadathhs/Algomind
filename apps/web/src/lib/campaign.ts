import type { BoardData, Dir } from "@/lib/board";

/**
 * The campaign as the public site shows it: worlds (one idea each), chapters inside a world, and
 * levels inside a chapter, in play order. This mirrors the planned `GET /v1/campaign` tree
 * (docs/README_ARCHITECTURE.md). The API has no levels yet, so `getCampaign` returns a bundled
 * sample, marked as such, and the page says so. When the endpoint exists this is the one function
 * to change.
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
};

export type Chapter = { id: string; title: string; levels: CampaignLevel[] };

export type World = {
  id: string;
  number: number;
  title: string;
  summary: string;
  /** The idea the world teaches. */
  teaches: string;
  chapters: Chapter[];
};

export type Campaign = {
  /** "sample" until published levels are served by the API. */
  source: "sample" | "published";
  worlds: World[];
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const FACING: Record<string, Dir> = { "^": "N", ">": "E", v: "S", "<": "W" };

/**
 * Reads a board from text rows, top to bottom: `.` floor, `#` wall, `G` target, and `^ > v <` for
 * the automaton facing north, east, south, or west. Throws on a malformed board, so a typo fails
 * the tests and the build, not the page.
 */
export function grid(rows: readonly string[]): BoardData {
  const width = rows[0]?.length ?? 0;
  const walls: BoardData["walls"] = [];
  let goal: BoardData["goal"] | null = null;
  let automaton: BoardData["automaton"] | null = null;
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Row ${y} is not ${width} cells wide`);
    row.split("").forEach((cell, x) => {
      if (cell === "#") walls.push({ x, y });
      else if (cell === "G") {
        if (goal) throw new Error("A board has exactly one target");
        goal = { x, y };
      } else if (cell in FACING) {
        if (automaton) throw new Error("A board has exactly one automaton");
        automaton = { x, y, dir: FACING[cell] };
      } else if (cell !== ".") throw new Error(`Unknown cell "${cell}"`);
    });
  });
  if (!goal || !automaton) throw new Error("A board needs a target and an automaton");
  return { width, height: rows.length, walls, goal, automaton };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

let counter = 0;
function level(
  title: string,
  difficulty: Difficulty,
  maxCommands: number,
  rows: readonly string[],
): CampaignLevel {
  counter += 1;
  return {
    slug: slugify(title),
    number: counter,
    title,
    difficulty,
    maxCommands,
    board: grid(rows),
  };
}

// The command limit is the shortest possible program plus some slack, shrinking world by world;
// in the last world it is exactly the shortest program. campaign.test.ts checks this against a
// breadth-first search, so the numbers cannot drift from the boards.
const SAMPLE_WORLDS: World[] = [
  {
    id: "sequences",
    number: 1,
    title: "Sequences",
    summary: "Instructions run in order, one after another.",
    teaches: "Sequencing",
    chapters: [
      {
        id: "first-steps",
        title: "First steps",
        levels: [
          level("Straight ahead", "easy", 5, [".....", "G....", ".....", ".....", "^...."]),
          level("All the way", "easy", 6, ["G....", ".....", ".....", ".....", "^...."]),
          level("Along the floor", "easy", 6, [".....", ".....", ".....", ".....", ">...G"]),
          level("Mind the gap", "easy", 6, ["G....", ".#...", ".#...", ".#...", "^...."]),
        ],
      },
    ],
  },
  {
    id: "turns",
    number: 2,
    title: "Turns",
    summary: "Turn before you move to change where you are going.",
    teaches: "Direction",
    chapters: [
      {
        id: "corners",
        title: "Corners",
        levels: [
          level("One turn", "easy", 8, [".....", ".....", "...G.", ".....", "^...."]),
          level("Turn left", "easy", 8, [".....", "..G..", ".....", ".....", ">...."]),
          level("Up and across", "easy", 8, [".....", "..G..", ".....", ".....", "^...."]),
          level("Turn around", "easy", 6, [".....", ".....", "..^..", ".....", "..G.."]),
        ],
      },
      {
        id: "around-walls",
        title: "Around walls",
        levels: [
          level("The wall", "medium", 12, [".....", ".....", ".#.G#", "..#..", "^#..."]),
          level("Two walls", "medium", 8, [".....", ".#.#.", ".....", ".#.#.", "^...G"]),
          level("The detour", "medium", 11, ["..#..", "..#G.", "..#..", "..#..", "^...."]),
          level("Long way round", "hard", 18, ["G....", "####.", ".....", ".####", "^...."]),
        ],
      },
    ],
  },
  {
    id: "planning",
    number: 3,
    title: "Planning",
    summary: "Look at the whole board first, then choose a route.",
    teaches: "Planning",
    chapters: [
      {
        id: "routes",
        title: "Routes",
        levels: [
          level("The ring", "medium", 7, [".....", ".#.#.", "..G..", ".#.#.", "^...."]),
          level("Pick a side", "medium", 9, ["..#..", ".....", "..#G.", ".....", "^.#.."]),
          level("Switchback", "hard", 12, ["....G", "####.", ".....", ".####", "^...."]),
          level("The maze", "hard", 18, ["..#G.", ".##..", "...#.", ".#...", "^.#.."]),
        ],
      },
    ],
  },
  {
    id: "limits",
    number: 4,
    title: "Limits",
    summary: "Solve it with exactly as many commands as it takes, no more.",
    teaches: "Constraints",
    chapters: [
      {
        id: "tight-budgets",
        title: "Tight budgets",
        levels: [
          level("Tight corner", "medium", 5, [".....", ".....", "..G..", ".....", ">...."]),
          level("Exactly enough", "hard", 6, [".....", ".###.", ".#G#.", ".#.#.", "^...."]),
          level("No wasted moves", "hard", 11, ["..#.G", "..#..", "..#..", "....#", "^...."]),
        ],
      },
    ],
  },
];

/** The campaign shown on the site. Sample data for now; see the note at the top of this file. */
export function getCampaign(): Campaign {
  return { source: "sample", worlds: SAMPLE_WORLDS };
}

export function levelCount(world: World): number {
  return world.chapters.reduce((total, chapter) => total + chapter.levels.length, 0);
}

export function allLevels(campaign: Campaign): CampaignLevel[] {
  return campaign.worlds.flatMap((world) => world.chapters.flatMap((chapter) => chapter.levels));
}
