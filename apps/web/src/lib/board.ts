export type Dir = "N" | "E" | "S" | "W";
export type Point = { x: number; y: number };
export type Command =
  "move" | "left" | "right" | "inc" | "mark" | "repeat" | "until" | "if" | "proc" | "call";

/** Everything the board renderer needs. Cells are addressed from the top-left, x to the right. */
export type BoardData = {
  width: number;
  height: number;
  walls: Point[];
  /** The target cell. Absent on a board whose goal is to visit every cell: it draws no target. */
  goal?: Point;
  automaton: Point & { dir: Dir };
  /** Cells the automaton has passed (the visited cells on a sweep board). */
  trail?: Point[];
  /** Breadcrumbs: a marked cell and the direction its arrow points (to the cell behind). */
  crumbs?: (Point & { dir: Dir })[];
  /** The wall that stopped a failed run. */
  hitWall?: Point;
};

/** Clockwise angle of the direction wedge, with east as zero. */
export const DIR_ANGLE: Record<Dir, number> = { E: 0, S: 90, W: 180, N: 270 };

export const COMMAND_LABEL: Record<Command, string> = {
  move: "MOVE",
  left: "LEFT",
  right: "RIGHT",
  inc: "COUNT",
  mark: "MARK",
  repeat: "REPEAT",
  until: "UNTIL",
  if: "IF",
  proc: "PROC",
  call: "CALL",
};

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function hasPoint(list: readonly Point[] | undefined, p: Point): boolean {
  return list?.some((q) => samePoint(q, p)) ?? false;
}

/** A short plain-language description of a board, for the accessible name of its drawing. */
export function describeBoard(board: BoardData): string {
  const walls = board.walls.length === 1 ? "1 wall" : `${board.walls.length} walls`;
  const goal = board.goal ? "one target" : "no target, every cell to be visited";
  return `Board of ${board.width} by ${board.height} cells with ${walls} and ${goal}.`;
}
