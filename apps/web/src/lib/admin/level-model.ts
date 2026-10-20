import {
  programSlots,
  simulate,
  validateAuthoringLevel,
  solve,
  type AuthoringLevel,
  type CommandName,
  type Level,
  type Program,
  type RunResult,
} from "@algomind/level-contract";
import type { BoardData, Command, Dir } from "@/lib/board";
import type { Instruction, LevelContent } from "./admin-api";

export const BOARD_MIN = 3;
export const BOARD_MAX = 12;
export const MAX_COMMANDS = { min: 1, max: 64 } as const;
export const MAX_STEPS = { min: 1, max: 1000 } as const;

export const COMMANDS: { op: CommandName; command: Command; label: string }[] = [
  { op: "MOVE_FORWARD", command: "move", label: "Move forward" },
  { op: "TURN_LEFT", command: "left", label: "Turn left" },
  { op: "TURN_RIGHT", command: "right", label: "Turn right" },
  { op: "REPEAT", command: "repeat", label: "Repeat" },
  { op: "REPEAT_UNTIL", command: "until", label: "Repeat until blocked" },
];

/** The most instructions a loop body holds and the range of its count (the contract's limits). */
export const REPEAT_LIMITS = { count: { min: 2, max: 11 }, body: { max: 8 } } as const;

/** The loop instructions: they carry a body and cost 1 slot plus the body. */
export const LOOP_OPS: readonly string[] = ["REPEAT", "REPEAT_UNTIL"];

export function isLoop(node: { op: string }): boolean {
  return LOOP_OPS.includes(node.op);
}

export const DIRECTIONS = ["north", "east", "south", "west"] as const;
export type Direction = (typeof DIRECTIONS)[number];

const DIR_LETTER: Record<Direction, Dir> = { north: "N", east: "E", south: "S", west: "W" };

/** The tape tiles for a program: a loop is its own tile followed by its body. One tile per slot. */
export function tileCommands(program: Instruction[]): Command[] {
  return program.flatMap((node) =>
    isLoop(node)
      ? [commandOf(node.op), ...(node.body ?? []).map((b) => commandOf(b.op))]
      : [commandOf(node.op)],
  );
}

export function commandOf(op: string): Command {
  return COMMANDS.find((c) => c.op === op)?.command ?? "move";
}

/** The board renderer's data for a level definition, optionally with a run's trail. */
export function boardData(
  content: LevelContent,
  extra: {
    automaton?: { x: number; y: number; dir: Direction };
    trail?: [number, number][];
    hit?: [number, number];
  } = {},
): BoardData {
  const [sx, sy] = content.initialState.position;
  const at = extra.automaton ?? { x: sx, y: sy, dir: content.initialState.direction };
  return {
    width: content.board.width,
    height: content.board.height,
    walls: content.board.walls.map(([x, y]) => ({ x, y })),
    goal: { x: content.goal.position[0], y: content.goal.position[1] },
    automaton: { x: at.x, y: at.y, dir: DIR_LETTER[at.dir] },
    trail: extra.trail?.map(([x, y]) => ({ x, y })),
    hitWall: extra.hit ? { x: extra.hit[0], y: extra.hit[1] } : undefined,
  };
}

export type Tool = "wall" | "floor" | "start" | "goal";

function hasWall(content: LevelContent, x: number, y: number): boolean {
  return content.board.walls.some(([wx, wy]) => wx === x && wy === y);
}

/** Applies one board tool to a cell. Returns the same object when nothing changes. */
export function applyTool(content: LevelContent, tool: Tool, x: number, y: number): LevelContent {
  const [sx, sy] = content.initialState.position;
  const [gx, gy] = content.goal.position;
  const wall = hasWall(content, x, y);
  switch (tool) {
    case "wall": {
      if (wall) return content;
      if ((x === sx && y === sy) || (x === gx && y === gy)) return content;
      return { ...content, board: { ...content.board, walls: [...content.board.walls, [x, y]] } };
    }
    case "floor": {
      if (!wall) return content;
      return {
        ...content,
        board: {
          ...content.board,
          walls: content.board.walls.filter(([wx, wy]) => wx !== x || wy !== y),
        },
      };
    }
    case "start": {
      if (wall || (x === gx && y === gy) || (x === sx && y === sy)) return content;
      return { ...content, initialState: { ...content.initialState, position: [x, y] } };
    }
    case "goal": {
      if (wall || (x === sx && y === sy) || (x === gx && y === gy)) return content;
      return { ...content, goal: { ...content.goal, position: [x, y] } };
    }
  }
}

/** Changes the board size. Walls outside the new board are dropped; start and goal are clamped. */
export function resizeBoard(content: LevelContent, width: number, height: number): LevelContent {
  const w = Math.min(BOARD_MAX, Math.max(BOARD_MIN, Math.round(width)));
  const h = Math.min(BOARD_MAX, Math.max(BOARD_MIN, Math.round(height)));
  const inside = ([x, y]: [number, number]) => x < w && y < h;
  const clamp = ([x, y]: [number, number]): [number, number] => [
    Math.min(x, w - 1),
    Math.min(y, h - 1),
  ];
  let start = clamp(content.initialState.position);
  let goal = clamp(content.goal.position);
  const walls = content.board.walls
    .filter(inside)
    .filter(([x, y]) => !(x === start[0] && y === start[1]) && !(x === goal[0] && y === goal[1]));
  if (start[0] === goal[0] && start[1] === goal[1]) {
    goal = [w - 1, h - 1];
    if (goal[0] === start[0] && goal[1] === start[1]) start = [0, 0];
  }
  return {
    ...content,
    board: { width: w, height: h, walls },
    initialState: { ...content.initialState, position: start },
    goal: { ...content.goal, position: goal },
  };
}

/** What the browser can tell an author before the server is asked (the server stays the authority). */
export function localCheck(content: LevelContent, referenceSolution: Instruction[]) {
  const authoring = { ...content, referenceSolution } as unknown as AuthoringLevel;
  const validation = validateAuthoringLevel(authoring);
  if (!validation.ok)
    return { validation, solved: null, par: null as null | { commands: number; steps: number } };
  const level = content as unknown as Level;
  const run = simulate(level, referenceSolution as Program);
  const best = solve(level);
  return {
    validation,
    solved: run.status === "SUCCEEDED",
    par: best ? { commands: best.commands, steps: best.steps } : null,
  };
}

export type { RunResult };
export { programSlots, simulate };

/** The slots a program uses (a loop is 1 plus its body), the number the command limit counts. */
export function slotsOf(program: Instruction[]): number {
  return programSlots(program as Program);
}

/** The unsaved-edit backup. It holds level content only, never tokens or credentials. */
export type DraftBackup = {
  savedAt: number;
  baseUpdatedAt: string;
  content: LevelContent;
  referenceSolution: Instruction[];
};

const BACKUP_PREFIX = "algomind-admin-draft:";

export function readBackup(levelId: string): DraftBackup | null {
  try {
    const raw = window.localStorage.getItem(BACKUP_PREFIX + levelId);
    return raw ? (JSON.parse(raw) as DraftBackup) : null;
  } catch {
    return null;
  }
}

export function writeBackup(levelId: string, backup: DraftBackup): void {
  try {
    window.localStorage.setItem(BACKUP_PREFIX + levelId, JSON.stringify(backup));
  } catch {
    // Storage may be blocked; saving to the server is the real path.
  }
}

export function clearBackup(levelId: string): void {
  try {
    window.localStorage.removeItem(BACKUP_PREFIX + levelId);
  } catch {
    // Nothing to clear.
  }
}
