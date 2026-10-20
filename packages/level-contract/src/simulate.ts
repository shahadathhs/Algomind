import {
  DIRECTIONS,
  DIRECTION_DELTAS,
  LIMITS,
  PRIMITIVE_COMMANDS,
  REPEAT_OP,
  REPEAT_UNTIL_OP,
  UNTIL_CONDITIONS,
} from "./constants.js";
import type {
  Direction,
  Level,
  Position,
  PrimitiveInstruction,
  PrimitiveName,
  Program,
  RepeatInstruction,
  RepeatUntilInstruction,
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

const PRIMITIVES = PRIMITIVE_COMMANDS as readonly string[];

function isPrimitiveNode(node: unknown): node is PrimitiveInstruction {
  return (
    typeof node === "object" &&
    node !== null &&
    typeof (node as { op?: unknown }).op === "string" &&
    PRIMITIVES.includes((node as { op: string }).op)
  );
}

/** A loop the simulator can run: a whole count in range and a body of 1 to 8 primitives. */
function isRunnableRepeat(node: unknown): node is RepeatInstruction {
  if (typeof node !== "object" || node === null) return false;
  const n = node as { op?: unknown; count?: unknown; body?: unknown };
  return (
    n.op === REPEAT_OP &&
    typeof n.count === "number" &&
    Number.isInteger(n.count) &&
    n.count >= LIMITS.repeatCount.min &&
    n.count <= LIMITS.repeatCount.max &&
    Array.isArray(n.body) &&
    n.body.length >= LIMITS.repeatBody.min &&
    n.body.length <= LIMITS.repeatBody.max &&
    n.body.every(isPrimitiveNode)
  );
}

function isRunnableBody(body: unknown): boolean {
  return (
    Array.isArray(body) &&
    body.length >= LIMITS.repeatBody.min &&
    body.length <= LIMITS.repeatBody.max &&
    body.every(isPrimitiveNode)
  );
}

/** A conditional loop the simulator can run: a known condition and a body of 1 to 8 primitives. */
function isRunnableRepeatUntil(node: unknown): node is RepeatUntilInstruction {
  if (typeof node !== "object" || node === null) return false;
  const n = node as { op?: unknown; until?: unknown; body?: unknown };
  return (
    n.op === REPEAT_UNTIL_OP &&
    typeof n.until === "string" &&
    (UNTIL_CONDITIONS as readonly string[]).includes(n.until) &&
    isRunnableBody(n.body)
  );
}

/**
 * Runs `program` on `level`. Deterministic and pure: the inputs are not modified.
 *
 * It expects a level that passed `validateLevel` and does not check `availableCommands` or `maxCommands`;
 * call `validateProgram` first. An instruction that is not a known primitive or a well-formed REPEAT stops
 * the run with INVALID_INSTRUCTION (it is never skipped). `program` must be an array.
 *
 * Every executed primitive is one step; a REPEAT or REPEAT_UNTIL itself costs none. A REPEAT_UNTIL checks
 * its condition before every round, so a loop whose way ahead is already blocked runs its body zero times; the
 * check is free and the loop ends only through the condition, the goal, a failure, or the step limit. The step limit is checked before each
 * node and before each primitive inside a loop. The run succeeds the moment the goal cell is entered, even
 * in the middle of a loop.
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

  const atLimit = (): boolean => trace.length >= level.constraints.maxSteps;

  /** Runs one primitive. Returns the final result when the run ends here, otherwise null. */
  const step = (command: PrimitiveName, node: number[], round: number | null): RunResult | null => {
    const index = trace.length;
    const entry = (event: TraceEntry["event"]): TraceEntry => ({
      index,
      op: command,
      node,
      round,
      position: [position[0], position[1]],
      direction,
      event,
    });

    if (command === "TURN_LEFT" || command === "TURN_RIGHT") {
      direction = turn(direction, command === "TURN_LEFT" ? "left" : "right");
      trace.push(entry("TURNED"));
      return null;
    }

    // MOVE_FORWARD
    const target = cellAhead(position, direction);
    if (!isInsideBoard(level, target)) {
      trace.push(entry("BLOCKED_BY_BOUNDARY"));
      return finish("FAILED", "BLOCKED_BY_BOUNDARY", target);
    }
    if (isWall(level, target)) {
      trace.push(entry("BLOCKED_BY_WALL"));
      return finish("FAILED", "BLOCKED_BY_WALL", target);
    }
    position = target;
    if (position[0] === goal[0] && position[1] === goal[1]) {
      trace.push(entry("GOAL_REACHED"));
      return finish("SUCCEEDED", "GOAL_REACHED", null);
    }
    trace.push(entry("MOVED"));
    return null;
  };

  for (let i = 0; i < program.length; i += 1) {
    const node: unknown = program[i];
    if (atLimit()) return finish("FAILED", "STEP_LIMIT", null);

    if (isPrimitiveNode(node)) {
      const result = step(node.op, [i], null);
      if (result) return result;
      continue;
    }
    if (isRunnableRepeatUntil(node)) {
      for (let round = 1; ; round += 1) {
        const ahead = cellAhead(position, direction);
        if (!isInsideBoard(level, ahead) || isWall(level, ahead)) break;
        for (let j = 0; j < node.body.length; j += 1) {
          if (atLimit()) return finish("FAILED", "STEP_LIMIT", null);
          const result = step(node.body[j]!.op, [i, j], round);
          if (result) return result;
        }
      }
      continue;
    }
    if (!isRunnableRepeat(node)) return finish("FAILED", "INVALID_INSTRUCTION", null);

    for (let round = 1; round <= node.count; round += 1) {
      for (let j = 0; j < node.body.length; j += 1) {
        if (atLimit()) return finish("FAILED", "STEP_LIMIT", null);
        const result = step(node.body[j]!.op, [i, j], round);
        if (result) return result;
      }
    }
  }

  return finish("FAILED", "PROGRAM_ENDED", null);
}
