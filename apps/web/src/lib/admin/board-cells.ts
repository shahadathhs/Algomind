import type { LevelContent } from "./admin-api";
import { type Cell, type TileState, tileAt } from "./tile-tools";

/** The cells of a board of this size, row by row from the top left. */
export function boardCells(width: number, height: number): Cell[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_row, x): Cell => [x, y]),
  ).flat();
}

/** What one cell of the board grid is, and what it shows. */
export type CellFacts = {
  start: boolean;
  goal: boolean;
  wall: boolean;
  /** A tile tool is waiting for this cell: the second of a pair, or the next of a route. */
  waiting: boolean;
  /** For the cell's accessible name: start, goal, wall, the tile on it, or floor. */
  word: string;
  /** ? while a tile tool waits for the cell, else the sign of its tile (empty on bare floor). */
  mark: string;
};

export function cellFacts(
  content: LevelContent,
  tileState: TileState,
  x: number,
  y: number,
): CellFacts {
  const [sx, sy] = content.initialState.position;
  const [gx, gy] = content.goal.position ?? [-1, -1];
  const start = x === sx && y === sy;
  const goal = x === gx && y === gy;
  const wall = content.board.walls.some(([wx, wy]) => wx === x && wy === y);
  const tile = tileAt(content, x, y);
  const waiting =
    (tileState.pending !== null && tileState.pending[0] === x && tileState.pending[1] === y) ||
    tileState.route.some(([rx, ry]) => rx === x && ry === y);
  return {
    start,
    goal,
    wall,
    waiting,
    word: start ? "start" : goal ? "goal" : wall ? "wall" : (tile?.word ?? "floor"),
    mark: waiting ? "?" : (tile?.mark ?? ""),
  };
}
