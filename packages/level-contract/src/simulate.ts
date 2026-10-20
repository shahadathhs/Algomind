import {
  DIRECTIONS,
  DIRECTION_DELTAS,
  LIMITS,
  PRIMITIVE_COMMANDS,
  IF_OP,
  REPEAT_OP,
  REPEAT_UNTIL_OP,
  SENSORS,
  UNTIL_CONDITIONS,
} from "./constants.js";
import type {
  BodyInstruction,
  Direction,
  IfInstruction,
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

function isPrimitiveList(list: unknown, min: number, max: number): boolean {
  return (
    Array.isArray(list) && list.length >= min && list.length <= max && list.every(isPrimitiveNode)
  );
}

/** An IF the simulator can run: a known sensor, 1 to 4 primitives to run, and 0 to 4 to run otherwise. */
function isRunnableIf(node: unknown): node is IfInstruction {
  if (typeof node !== "object" || node === null) return false;
  const n = node as { op?: unknown; when?: unknown; then?: unknown; else?: unknown };
  return (
    n.op === IF_OP &&
    typeof n.when === "string" &&
    (SENSORS as readonly string[]).includes(n.when) &&
    isPrimitiveList(n.then, LIMITS.ifThen.min, LIMITS.ifThen.max) &&
    isPrimitiveList(n.else, LIMITS.ifElse.min, LIMITS.ifElse.max)
  );
}

function isRunnableBody(body: unknown): body is BodyInstruction[] {
  return (
    Array.isArray(body) &&
    body.length >= LIMITS.repeatBody.min &&
    body.length <= LIMITS.repeatBody.max &&
    body.every((item) => isPrimitiveNode(item) || isRunnableIf(item))
  );
}

/** A loop the simulator can run: a whole count in range and a body of 1 to 8 primitives and IFs. */
function isRunnableRepeat(node: unknown): node is RepeatInstruction {
  if (typeof node !== "object" || node === null) return false;
  const n = node as { op?: unknown; count?: unknown; body?: unknown };
  return (
    n.op === REPEAT_OP &&
    typeof n.count === "number" &&
    Number.isInteger(n.count) &&
    n.count >= LIMITS.repeatCount.min &&
    n.count <= LIMITS.repeatCount.max &&
    isRunnableBody(n.body)
  );
}

/** A conditional loop the simulator can run: a known condition and a body of 1 to 8 primitives and IFs. */
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
 * Every executed primitive is one step; a REPEAT, REPEAT_UNTIL or IF itself costs none, and choosing an IF's
 * branch is free (the sensor is read when the IF is reached). A REPEAT_UNTIL checks
 * its condition before every round, so a loop whose way ahead is already blocked runs its body zero times; the
 * check is free and the loop ends only through the condition, the goal, a failure, or the step limit. A round of
 * a REPEAT_UNTIL that runs no primitive at all (every IF chose an empty branch) would repeat for ever, so it
 * stops the run with STEP_LIMIT. The step limit is checked before each
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

  const isClear = (sensor: IfInstruction["when"]): boolean => {
    const facing =
      sensor === "CLEAR_AHEAD"
        ? direction
        : turn(direction, sensor === "CLEAR_LEFT" ? "left" : "right");
    const cell = cellAhead(position, facing);
    return isInsideBoard(level, cell) && !isWall(level, cell);
  };

  /** Runs one primitive or IF at `path`. Returns the final result when the run ends here, otherwise null. */
  const runItem = (
    item: BodyInstruction,
    path: number[],
    round: number | null,
  ): RunResult | null => {
    if (item.op !== IF_OP) return step(item.op, path, round);
    const branch = isClear(item.when) ? item.then : item.else;
    const offset = branch === item.then ? 0 : item.then.length;
    for (let k = 0; k < branch.length; k += 1) {
      if (atLimit()) return finish("FAILED", "STEP_LIMIT", null);
      const result = step(branch[k]!.op, [...path, offset + k], round);
      if (result) return result;
    }
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
    if (isRunnableIf(node)) {
      const result = runItem(node, [i], null);
      if (result) return result;
      continue;
    }
    if (isRunnableRepeatUntil(node)) {
      for (let round = 1; ; round += 1) {
        if (node.until === "BLOCKED" && !isClear("CLEAR_AHEAD")) break;
        const before = trace.length;
        for (let j = 0; j < node.body.length; j += 1) {
          const item = node.body[j]!;
          if (item.op !== IF_OP && atLimit()) return finish("FAILED", "STEP_LIMIT", null);
          const result = runItem(item, [i, j], round);
          if (result) return result;
        }
        if (trace.length === before) return finish("FAILED", "STEP_LIMIT", null);
      }
      continue;
    }
    if (!isRunnableRepeat(node)) return finish("FAILED", "INVALID_INSTRUCTION", null);

    for (let round = 1; round <= node.count; round += 1) {
      for (let j = 0; j < node.body.length; j += 1) {
        const item = node.body[j]!;
        if (item.op !== IF_OP && atLimit()) return finish("FAILED", "STEP_LIMIT", null);
        const result = runItem(item, [i, j], round);
        if (result) return result;
      }
    }
  }

  return finish("FAILED", "PROGRAM_ENDED", null);
}
