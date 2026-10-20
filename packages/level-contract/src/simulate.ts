import {
  CALL_OP,
  DIRECTIONS,
  DIRECTION_DELTAS,
  IF_OP,
  LIMITS,
  PRIMITIVE_COMMANDS,
  PROCEDURE_NAMES,
  PROC_OP,
  REPEAT_OP,
  REPEAT_UNTIL_OP,
  SENSORS,
  UNTIL_CONDITIONS,
} from "./constants.js";
import type {
  Direction,
  IfInstruction,
  Level,
  Position,
  PrimitiveInstruction,
  PrimitiveName,
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

const PRIMITIVES = PRIMITIVE_COMMANDS as readonly string[];

type Node = Record<string, unknown>;

function isNode(node: unknown): node is Node {
  return typeof node === "object" && node !== null;
}

function isPrimitiveNode(node: unknown): node is PrimitiveInstruction {
  return isNode(node) && typeof node["op"] === "string" && PRIMITIVES.includes(node["op"]);
}

function isPrimitiveList(list: unknown, min: number, max: number): boolean {
  return (
    Array.isArray(list) && list.length >= min && list.length <= max && list.every(isPrimitiveNode)
  );
}

/** Where a node stands, which decides what it may hold. */
type Place = "top" | "loopBody" | "procBody" | "procLoopBody";

/**
 * True when the node and everything inside it can be run: known ops and conditions, bodies and branches
 * of the right size, and only what the place allows. `procs` are the procedures a CALL may name.
 */
function runnable(node: unknown, place: Place, procs: ReadonlyMap<string, Node>): boolean {
  if (!isNode(node)) return false;
  const op = node["op"];
  if (isPrimitiveNode(node)) return true;
  if (op === IF_OP) {
    return (
      typeof node["when"] === "string" &&
      (SENSORS as readonly string[]).includes(node["when"]) &&
      isPrimitiveList(node["then"], LIMITS.ifThen.min, LIMITS.ifThen.max) &&
      isPrimitiveList(node["else"], LIMITS.ifElse.min, LIMITS.ifElse.max)
    );
  }
  if (op === CALL_OP) {
    return (
      (place === "top" || place === "loopBody") &&
      typeof node["name"] === "string" &&
      procs.has(node["name"])
    );
  }
  const body = node["body"];
  const bodyOk = (min: number, max: number, inner: Place): boolean =>
    Array.isArray(body) &&
    body.length >= min &&
    body.length <= max &&
    body.every((item) => runnable(item, inner, procs));
  if (op === REPEAT_OP || op === REPEAT_UNTIL_OP) {
    if (place === "loopBody" || place === "procLoopBody") return false;
    const inner: Place = place === "procBody" ? "procLoopBody" : "loopBody";
    if (op === REPEAT_OP) {
      const count = node["count"];
      if (
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < LIMITS.repeatCount.min ||
        count > LIMITS.repeatCount.max
      ) {
        return false;
      }
    } else if (
      typeof node["until"] !== "string" ||
      !(UNTIL_CONDITIONS as readonly string[]).includes(node["until"])
    ) {
      return false;
    }
    return bodyOk(LIMITS.repeatBody.min, LIMITS.repeatBody.max, inner);
  }
  if (op === PROC_OP) {
    return (
      place === "top" &&
      typeof node["name"] === "string" &&
      (PROCEDURE_NAMES as readonly string[]).includes(node["name"]) &&
      bodyOk(LIMITS.procBody.min, LIMITS.procBody.max, "procBody")
    );
  }
  return false;
}

/**
 * Runs `program` on `level`. Deterministic and pure: the inputs are not modified.
 *
 * It expects a level that passed `validateLevel` and does not check `availableCommands` or `maxCommands`;
 * call `validateProgram` first. An instruction that is not a known primitive or a well-formed loop, IF,
 * CALL or PROC stops the run with INVALID_INSTRUCTION (it is never skipped). `program` must be an array.
 *
 * Every executed primitive is one step; a loop, IF, CALL or PROC itself costs none, and choosing an IF's
 * branch is free (the sensor is read when the IF is reached). A REPEAT_UNTIL checks its condition before
 * every round, so a loop whose way ahead is already blocked runs its body zero times; the check is free and
 * the loop ends only through the condition, the goal, a failure, or the step limit. A round of a
 * REPEAT_UNTIL that runs no primitive at all (every IF chose an empty branch) would repeat for ever, so it
 * stops the run with STEP_LIMIT.
 *
 * A PROC node is a definition: where it stands it is skipped (it costs nothing and does not run). The main
 * program is the other top-level nodes in order, and a CALL runs the body of the first PROC of that name.
 * The step limit is checked before each top-level node that is run and before each primitive. The run
 * succeeds the moment the goal cell is entered, wherever that happens.
 */
export function simulate(level: Level, program: Program): RunResult {
  if (!Array.isArray(program)) throw new TypeError("program must be an array");

  let position: Position = [level.initialState.position[0], level.initialState.position[1]];
  let direction: Direction = level.initialState.direction;
  const goal = level.goal.position;
  const trace: TraceEntry[] = [];

  // The procedures a CALL can reach: the first well-formed definition of each name.
  const procs = new Map<string, Node>();
  const procIndex = new Map<string, number>();
  const noProcs = new Map<string, Node>();
  program.forEach((node, i) => {
    const candidate: unknown = node;
    if (!isNode(candidate) || candidate["op"] !== PROC_OP) return;
    const name = candidate["name"];
    if (typeof name !== "string" || procs.has(name)) return;
    if (runnable(candidate, "top", noProcs)) {
      procs.set(name, candidate);
      procIndex.set(name, i);
    }
  });

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
  const step = (
    command: PrimitiveName,
    node: number[],
    round: number | null,
    call: number[] | null,
  ): RunResult | null => {
    if (atLimit()) return finish("FAILED", "STEP_LIMIT", null);
    const index = trace.length;
    const entry = (event: TraceEntry["event"]): TraceEntry => ({
      index,
      op: command,
      node,
      call,
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

  /**
   * Runs one checked node at `path`. `round` is the round of the loop it stands in and `call` the CALL that
   * is running it. Returns the final result when the run ends here, otherwise null.
   */
  const run = (
    node: Node,
    path: number[],
    round: number | null,
    call: number[] | null,
  ): RunResult | null => {
    const op = node["op"];
    if (isPrimitiveNode(node)) return step(node.op, path, round, call);

    if (op === IF_OP) {
      const then = node["then"] as PrimitiveInstruction[];
      const other = node["else"] as PrimitiveInstruction[];
      const taken = isClear(node["when"] as IfInstruction["when"]) ? then : other;
      const offset = taken === then ? 0 : then.length;
      for (let k = 0; k < taken.length; k += 1) {
        const result = step(taken[k]!.op, [...path, offset + k], round, call);
        if (result) return result;
      }
      return null;
    }

    if (op === CALL_OP) {
      const name = node["name"] as string;
      const body = procs.get(name)!["body"] as Node[];
      const base = [procIndex.get(name)!];
      for (let j = 0; j < body.length; j += 1) {
        const result = run(body[j]!, [...base, j], null, path);
        if (result) return result;
      }
      return null;
    }

    const body = node["body"] as Node[];
    if (op === REPEAT_OP) {
      for (let r = 1; r <= (node["count"] as number); r += 1) {
        for (let j = 0; j < body.length; j += 1) {
          const result = run(body[j]!, [...path, j], r, call);
          if (result) return result;
        }
      }
      return null;
    }

    // REPEAT_UNTIL
    for (let r = 1; ; r += 1) {
      if (node["until"] === "BLOCKED" && !isClear("CLEAR_AHEAD")) return null;
      const before = trace.length;
      for (let j = 0; j < body.length; j += 1) {
        const result = run(body[j]!, [...path, j], r, call);
        if (result) return result;
      }
      if (trace.length === before) return finish("FAILED", "STEP_LIMIT", null);
    }
  };

  for (let i = 0; i < program.length; i += 1) {
    const node: unknown = program[i];
    if (isNode(node) && node["op"] === PROC_OP) {
      // A definition: skipped when it is well formed, a content error when it is not.
      if (!runnable(node, "top", noProcs)) return finish("FAILED", "INVALID_INSTRUCTION", null);
      continue;
    }
    if (atLimit()) return finish("FAILED", "STEP_LIMIT", null);
    if (!runnable(node, "top", procs)) return finish("FAILED", "INVALID_INSTRUCTION", null);
    const result = run(node as Node, [i], null, null);
    if (result) return result;
  }

  return finish("FAILED", "PROGRAM_ENDED", null);
}
