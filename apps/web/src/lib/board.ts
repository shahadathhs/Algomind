export type Dir = "N" | "E" | "S" | "W";
export type Point = { x: number; y: number };
export type Command = "move" | "left" | "right" | "repeat" | "until" | "if";

/** Everything the board renderer needs. Cells are addressed from the top-left, x to the right. */
export type BoardData = {
  width: number;
  height: number;
  walls: Point[];
  goal: Point;
  automaton: Point & { dir: Dir };
  /** Cells the automaton has passed. */
  trail?: Point[];
  /** The wall that stopped a failed run. */
  hitWall?: Point;
};

/** Clockwise angle of the direction wedge, with east as zero. */
export const DIR_ANGLE: Record<Dir, number> = { E: 0, S: 90, W: 180, N: 270 };

export const COMMAND_LABEL: Record<Command, string> = {
  move: "MOVE",
  left: "LEFT",
  right: "RIGHT",
  repeat: "REPEAT",
  until: "UNTIL",
  if: "IF",
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
  return `Board of ${board.width} by ${board.height} cells with ${walls} and one target.`;
}
