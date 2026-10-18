import { COMMAND_NAMES, DIRECTIONS, DIRECTION_DELTAS } from "./constants.js";
import type {
  CommandName,
  Direction,
  Level,
  Position,
  Program,
  RunResult,
  TraceEntry,
} from "./types.js";

/** Rotates a direction by 90 degrees. "left" is counterclockwise, "right" is clockwise. */
export function turn(direction: Direction, side: "left" | "right"): Direction {
  const i = DIRECTIONS.indexOf(direction);
  const next = (i + (side === "right" ? 1 : 3)) % 4;
  return DIRECTIONS[next] as Direction;
}

/** The cell one step ahead of `position` when facing `direction`. May lie outside the board. */
export function cellAhead(position: Position, direction: Direction): Position {
  const [dx, dy] = DIRECTION_DELTAS[direction];
  return [position[0] + dx, position[1] + dy];
}

export function isWall(level: Level, cell: Position): boolean {
  return level.board.walls.some((w) => w[0] === cell[0] && w[1] === cell[1]);
}

export function isInsideBoard(level: Level, cell: Position): boolean {
  return (
    cell[0] >= 0 && cell[1] >= 0 && cell[0] < level.board.width && cell[1] < level.board.height
  );
}

/**
 * Runs `program` on `level`. Deterministic and pure: the inputs are not modified.
 *
 * It expects a level that passed `validateLevel` and does not check `availableCommands` or `maxCommands`;
 * call `validateProgram` first. An instruction whose op is not one of the three known commands stops the
 * run with INVALID_INSTRUCTION (it is never skipped). `program` must be an array.
 */
export function simulate(level: Level, program: Program): RunResult {
  if (!Array.isArray(program)) throw new TypeError("program must be an array");

  let position: Position = [level.initialState.position[0], level.initialState.position[1]];
  let direction: Direction = level.initialState.direction;
  const goal = level.goal.position;
  const trace: TraceEntry[] = [];

  const finish = (
    status: RunResult["status"],
    reason: RunResult["reason"],
    blockedCell: Position | null,
  ): RunResult => ({
    status,
    reason,
    steps: trace.length,
    finalState: { position: [position[0], position[1]], direction },
    blockedCell,
    trace,
  });

  for (const node of program) {
    if (trace.length >= level.constraints.maxSteps) return finish("FAILED", "STEP_LIMIT", null);

    const op: unknown = typeof node === "object" && node !== null ? node.op : undefined;
    if (typeof op !== "string" || !(COMMAND_NAMES as readonly string[]).includes(op)) {
      return finish("FAILED", "INVALID_INSTRUCTION", null);
    }
    const command = op as CommandName;
    const index = trace.length;

    if (command === "TURN_LEFT" || command === "TURN_RIGHT") {
      direction = turn(direction, command === "TURN_LEFT" ? "left" : "right");
      trace.push({
        index,
        op: command,
        position: [position[0], position[1]],
        direction,
        event: "TURNED",
      });
      continue;
    }

    // MOVE_FORWARD
    const target = cellAhead(position, direction);
    if (!isInsideBoard(level, target)) {
      trace.push({
        index,
        op: command,
        position: [position[0], position[1]],
        direction,
        event: "BLOCKED_BY_BOUNDARY",
      });
      return finish("FAILED", "BLOCKED_BY_BOUNDARY", target);
    }
    if (isWall(level, target)) {
      trace.push({
        index,
        op: command,
        position: [position[0], position[1]],
        direction,
        event: "BLOCKED_BY_WALL",
      });
      return finish("FAILED", "BLOCKED_BY_WALL", target);
    }
    position = target;
    if (position[0] === goal[0] && position[1] === goal[1]) {
      trace.push({
        index,
        op: command,
        position: [position[0], position[1]],
        direction,
        event: "GOAL_REACHED",
      });
      return finish("SUCCEEDED", "GOAL_REACHED", null);
    }
    trace.push({
      index,
      op: command,
      position: [position[0], position[1]],
      direction,
      event: "MOVED",
    });
  }

  return finish("FAILED", "PROGRAM_ENDED", null);
}
