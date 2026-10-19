import {
  FAILED_BOARD,
  FAILED_PROGRAM,
  READY_BOARD,
  RUNNING_BOARD,
  SOLUTION,
  SOLVED_BOARD,
} from "@/lib/sample-screens";
import type { BoardData } from "@/lib/board";
import { tapeFromProgram, type TapeTile } from "@/lib/tape";
import type { GameScreenState } from "../game-screen";

export type Frame = {
  board: BoardData;
  tiles: TapeTile[];
  head?: number;
  label: string;
};

export function frameFor(state: GameScreenState): Frame {
  switch (state) {
    case "ready":
      return {
        board: READY_BOARD,
        tiles: tapeFromProgram(SOLUTION.slice(0, 4), { emptySlot: "plus" }),
        label: "Game screen while building: four instructions on the tape and a Run button.",
      };
    case "running":
      return {
        board: RUNNING_BOARD,
        tiles: tapeFromProgram(SOLUTION, { current: 4 }),
        head: 4,
        label:
          "Game screen while running: the tape is under the read-head at step 5 and the automaton is on its way to the target.",
      };
    case "failed":
      return {
        board: FAILED_BOARD,
        tiles: tapeFromProgram(FAILED_PROGRAM, { current: 3, failed: true }),
        head: 3,
        label:
          "Game screen after a failed run: the automaton tried to move into a wall, the wall is striped yellow and the failing step is marked with a cross.",
      };
    case "solved":
      return {
        board: SOLVED_BOARD,
        tiles: tapeFromProgram(SOLUTION, { current: SOLUTION.length - 1, emptySlot: "plain" }),
        head: SOLUTION.length - 1,
        label: "Game screen after solving the level: 9 of 10 commands, 9 steps.",
      };
  }
}
