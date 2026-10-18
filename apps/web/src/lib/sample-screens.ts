import type { BoardData, Command } from "@/lib/board";

/**
 * Hand-authored frames of one level ("Around the wall") for the landing page drawings. They show
 * states of the game screen; they are display data, not a simulation (the rules live in the
 * reference simulator). The solving program is Move x3, Right, Move x3, Right, Move.
 */
export const LEVEL_TITLE = "AROUND THE WALL";
export const LEVEL_NUMBER = "04";
export const COMMAND_BUDGET = 10;

export const SOLUTION: readonly Command[] = [
  "move",
  "move",
  "move",
  "right",
  "move",
  "move",
  "move",
  "right",
  "move",
];

/** A different program: Move, Move, Right, Move. Its fourth step runs into the wall at (1, 2). */
export const FAILED_PROGRAM: readonly Command[] = ["move", "move", "right", "move", "move", "move"];

export const READY_BOARD: BoardData = {
  width: 5,
  height: 5,
  walls: [
    { x: 1, y: 2 },
    { x: 4, y: 2 },
    { x: 2, y: 3 },
    { x: 1, y: 4 },
  ],
  goal: { x: 3, y: 2 },
  automaton: { x: 0, y: 4, dir: "N" },
};

/** After step 5 of the solution: up the left edge, turned right, one cell along the top. */
export const RUNNING_BOARD: BoardData = {
  ...READY_BOARD,
  automaton: { x: 1, y: 1, dir: "E" },
  trail: [
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 0, y: 3 },
    { x: 0, y: 4 },
  ],
};

export const FAILED_BOARD: BoardData = {
  ...READY_BOARD,
  automaton: { x: 0, y: 2, dir: "E" },
  trail: [
    { x: 0, y: 3 },
    { x: 0, y: 4 },
  ],
  hitWall: { x: 1, y: 2 },
};

export const SOLVED_BOARD: BoardData = {
  ...READY_BOARD,
  automaton: { x: 3, y: 2, dir: "S" },
  trail: [
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 0, y: 3 },
    { x: 0, y: 4 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ],
};
