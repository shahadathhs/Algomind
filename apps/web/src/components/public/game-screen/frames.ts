import {
  COMMAND_BUDGET,
  FAILED_BOARD,
  FAILED_PROGRAM,
  READY_BOARD,
  READY_COUNT,
  RUNNING_BOARD,
  RUNNING_STEP,
  SOLUTION,
  SOLVED_BOARD,
  SOLVED_STATS,
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
        tiles: tapeFromProgram(SOLUTION.slice(0, READY_COUNT), { emptySlot: "plus" }),
        label: `Game screen while building: ${READY_COUNT} instructions on the tape and a Run button.`,
      };
    case "running":
      return {
        board: RUNNING_BOARD,
        tiles: tapeFromProgram(SOLUTION, { current: RUNNING_STEP }),
        head: RUNNING_STEP,
        label: `Game screen while running: the tape is under the read-head at step ${RUNNING_STEP + 1} and the automaton is on its way to the target.`,
      };
    case "failed":
      return {
        board: FAILED_BOARD,
        tiles: tapeFromProgram(FAILED_PROGRAM, {
          current: FAILED_PROGRAM.length - 1,
          failed: true,
        }),
        head: FAILED_PROGRAM.length - 1,
        label:
          "Game screen after a failed run: the automaton tried to move into a wall, the wall is striped yellow and the failing step is marked with a cross.",
      };
    case "solved":
      return {
        board: SOLVED_BOARD,
        tiles: tapeFromProgram(SOLUTION, { current: SOLUTION.length - 1, emptySlot: "plain" }),
        head: SOLUTION.length - 1,
        label: `Game screen after solving the level: ${SOLVED_STATS.used} of ${COMMAND_BUDGET} commands, ${SOLVED_STATS.steps} steps.`,
      };
  }
}
