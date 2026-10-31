import {
  ACTION_COMMANDS,
  CALL_OP,
  COUNTER_REF,
  DIRECTIONS,
  DIRECTION_DELTAS,
  IF_OP,
  INC_OP,
  LIMITS,
  MARK_OP,
  PROCEDURE_NAMES,
  PROC_OP,
  REPEAT_OP,
  REPEAT_UNTIL_OP,
  SENSORS,
  UNTIL_CONDITIONS,
} from "./constants.js";
import { patrolMeeting } from "./patrol.js";
import type {
  ActionName,
  Direction,
  Level,
  Position,
  PrimitiveInstruction,
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

const ACTIONS = ACTION_COMMANDS as readonly string[];

type Node = Record<string, unknown>;

function isNode(node: unknown): node is Node {
  return typeof node === "object" && node !== null;
}

function isActionNode(node: unknown): node is PrimitiveInstruction {
  return isNode(node) && typeof node["op"] === "string" && ACTIONS.includes(node["op"]);
}

function isActionList(list: unknown, min: number, max: number): boolean {
  return (
    Array.isArray(list) && list.length >= min && list.length <= max && list.every(isActionNode)
  );
}

/** Where a node stands, which decides what it may hold. */
type Place = {
  /** Inside a procedure body (a CALL may not stand there). */
  inProc: boolean;
  /** How many loops enclose the node (a loop needs fewer than two). */
  loops: number;
  /** Inside an IF branch (only actions may stand there). */
  branch: boolean;
  top: boolean;
};

const TOP: Place = { inProc: false, loops: 0, branch: false, top: true };

/** An IF whose branches can run: a known sensor, 1 to 4 actions to run, and 0 to 4 actions or one IF otherwise. */
function runnableIf(node: Node, chain: number): boolean {
  if (chain > LIMITS.ifChain) return false;
  if (typeof node["when"] !== "string" || !(SENSORS as readonly string[]).includes(node["when"])) {
    return false;
  }
  if (!isActionList(node["then"], LIMITS.ifThen.min, LIMITS.ifThen.max)) return false;
  const other = node["else"];
  if (Array.isArray(other) && other.length === 1 && isNode(other[0]) && other[0]["op"] === IF_OP) {
    return runnableIf(other[0], chain + 1);
  }
  return isActionList(other, LIMITS.ifElse.min, LIMITS.ifElse.max);
}

/**
 * True when the node and everything inside it can be run: known ops and conditions, bodies and branches
 * of the right size, and only what the place allows. `procs` are the procedures a CALL may name.
 */
function runnable(node: unknown, place: Place, procs: ReadonlyMap<string, Node>): boolean {
  if (!isNode(node)) return false;
  const op = node["op"];
  if (isActionNode(node)) return true;
  if (op === IF_OP) return !place.branch && runnableIf(node, 1);
  if (op === CALL_OP) {
    return (
      !place.inProc && !place.branch && typeof node["name"] === "string" && procs.has(node["name"])
    );
  }
  const body = node["body"];
  const bodyOk = (min: number, max: number, inner: Place): boolean =>
    Array.isArray(body) &&
    body.length >= min &&
    body.length <= max &&
    body.every((item) => runnable(item, inner, procs));
  if (op === REPEAT_OP || op === REPEAT_UNTIL_OP) {
    if (place.branch || place.loops >= 2) return false;
    if (op === REPEAT_OP) {
      const count = node["count"];
      const fixed =
        typeof count === "number" &&
        Number.isInteger(count) &&
        count >= LIMITS.repeatCount.min &&
        count <= LIMITS.repeatCount.max;
      if (!fixed && count !== COUNTER_REF) return false;
    } else if (
      typeof node["until"] !== "string" ||
      !(UNTIL_CONDITIONS as readonly string[]).includes(node["until"])
    ) {
      return false;
    }
    return bodyOk(LIMITS.repeatBody.min, LIMITS.repeatBody.max, {
      ...place,
      top: false,
      loops: place.loops + 1,
    });
  }
  if (op === PROC_OP) {
    return (
      place.top &&
      typeof node["name"] === "string" &&
      (PROCEDURE_NAMES as readonly string[]).includes(node["name"]) &&
      bodyOk(LIMITS.procBody.min, LIMITS.procBody.max, {
        inProc: true,
        loops: 0,
        branch: false,
        top: false,
      })
    );
  }
  return false;
}

/**
 * Runs `program` on `level`. Deterministic and pure: the inputs are not modified.
 *
 * It expects a level that passed `validateLevel` and does not check `availableCommands`, `requires` or
 * `maxCommands`; call `validateProgram` first. An instruction that is not a known action or a well-formed
 * loop, IF, CALL or PROC stops the run with INVALID_INSTRUCTION (it is never skipped). `program` must be an
 * array. It runs the level's own board only; `simulateAll` runs every board.
 *
 * Every executed action (a move, a turn, INC or MARK) is one step; a loop, IF, CALL or PROC itself costs
 * none, and choosing an IF's branch is free (the sensor is read when the IF is reached). A REPEAT_UNTIL
 * checks its condition before every round, so a loop whose way ahead is already blocked runs its body zero
 * times; the check is free and the loop ends only through the condition, the goal, a failure, or the step
 * limit. A round of a REPEAT_UNTIL that runs no action at all (every IF chose an empty branch) would repeat
 * for ever, so it stops the run with STEP_LIMIT. A REPEAT with count "N" reads the counter when it starts.
 *
 * Two things are tracked while a run goes on. The counter N starts at 1 and INC adds one (up to 11). MARK
 * drops a breadcrumb on the cell the automaton stands on: an arrow to the cell behind it, kept if the cell
 * already has one. The marker sensors read the breadcrumbs.
 *
 * A PROC node is a definition: where it stands it is skipped (it costs nothing and does not run). The main
 * program is the other top-level nodes in order, and a CALL runs the body of the first PROC of that name.
 * The step limit is checked before each top-level node that is run and before each action. The run
 * succeeds the moment the goal is met: the target cell is entered, or (goal `visit_all`) the last floor cell
 * is entered for the first time.
 */
export function simulate(level: Level, program: Program): RunResult {
  if (!Array.isArray(program)) throw new TypeError("program must be an array");

  const { width, height } = level.board;
  let position: Position = [level.initialState.position[0], level.initialState.position[1]];
  let direction: Direction = level.initialState.direction;
  const target = level.goal.type === "reach_tile" ? level.goal.position : null;
  const trace: TraceEntry[] = [];
  let counter: number = LIMITS.counter.start;

  const cellKey = (cell: Position): number => cell[1] * width + cell[0];
  const walls = new Set(level.board.walls.map(cellKey));
  const floorCells = width * height - walls.size;
  // Breadcrumbs: for a cell that has one, the direction (an index into DIRECTIONS) of the cell it points to.
  const crumbs = new Map<number, number>();
  const visited = new Set<number>([cellKey(position)]);

  // The procedures a CALL can reach: the first well-formed definition of each name.
  const procs = new Map<string, Node>();
  const procIndex = new Map<string, number>();
  const noProcs = new Map<string, Node>();
  program.forEach((node, i) => {
    const candidate: unknown = node;
    if (!isNode(candidate) || candidate["op"] !== PROC_OP) return;
    const name = candidate["name"];
    if (typeof name !== "string" || procs.has(name)) return;
    if (runnable(candidate, TOP, noProcs)) {
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
  const onBoard = (cell: Position): boolean => isInsideBoard(level, cell);
  const isFloor = (cell: Position): boolean => onBoard(cell) && !walls.has(cellKey(cell));

  /** Runs one action. Returns the final result when the run ends here, otherwise null. */
  const step = (
    command: ActionName,
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
      counter,
      round,
      position: [position[0], position[1]],
      direction,
      event,
    });

    /** A patrol that reaches the automaton in this step ends the run (checked before the goal). */
    const caught = (from: Position): RunResult | null => {
      const meeting = patrolMeeting(level, from, position, index);
      if (!meeting) return null;
      trace.push(entry("HIT_BY_PATROL"));
      return finish("FAILED", "HIT_BY_PATROL", meeting);
    };
    /** Ends an action that does not move the automaton: caught by a patrol, or done with `event`. */
    const stayed = (event: TraceEntry["event"]): RunResult | null => {
      const hit = caught(position);
      if (hit) return hit;
      trace.push(entry(event));
      return null;
    };

    if (command === "TURN_LEFT" || command === "TURN_RIGHT") {
      direction = turn(direction, command === "TURN_LEFT" ? "left" : "right");
      return stayed("TURNED");
    }
    if (command === INC_OP) {
      counter = Math.min(counter + 1, LIMITS.counter.max);
      return stayed("COUNTED");
    }
    if (command === MARK_OP) {
      const here = cellKey(position);
      if (!crumbs.has(here)) crumbs.set(here, (DIRECTIONS.indexOf(direction) + 2) % 4);
      return stayed("MARKED");
    }

    // MOVE_FORWARD
    const ahead = cellAhead(position, direction);
    if (!onBoard(ahead)) {
      trace.push(entry("BLOCKED_BY_BOUNDARY"));
      return finish("FAILED", "BLOCKED_BY_BOUNDARY", ahead);
    }
    if (walls.has(cellKey(ahead))) {
      trace.push(entry("BLOCKED_BY_WALL"));
      return finish("FAILED", "BLOCKED_BY_WALL", ahead);
    }
    const from: Position = position;
    position = ahead;
    visited.add(cellKey(position));
    const hit = caught(from);
    if (hit) return hit;
    const reached = target
      ? position[0] === target[0] && position[1] === target[1]
      : visited.size === floorCells;
    if (reached) {
      trace.push(entry("GOAL_REACHED"));
      return finish("SUCCEEDED", "GOAL_REACHED", null);
    }
    trace.push(entry("MOVED"));
    return null;
  };

  /** True when the sensor reads true: the cell on that side is floor (CLEAR), has no breadcrumb (FRESH), or is the cell this cell's breadcrumb points to (BACK). */
  const sensor = (name: string): boolean => {
    const [kind, side] = name.split("_") as [string, string];
    const facing =
      side === "AHEAD" ? direction : turn(direction, side === "LEFT" ? "left" : "right");
    const cell = cellAhead(position, facing);
    if (!isFloor(cell)) return false;
    if (kind === "CLEAR") return true;
    if (kind === "FRESH") return !crumbs.has(cellKey(cell));
    const toward = crumbs.get(cellKey(position));
    if (toward === undefined) return false;
    const [dx, dy] = DIRECTION_DELTAS[DIRECTIONS[toward]!];
    return cell[0] === position[0] + dx && cell[1] === position[1] + dy;
  };

  /** Runs an IF: its `then` actions, or its `else` (actions, or the next IF of an else-if chain). */
  const runIf = (
    node: Node,
    path: number[],
    round: number | null,
    call: number[] | null,
  ): RunResult | null => {
    const then = node["then"] as PrimitiveInstruction[];
    const other = node["else"] as Node[];
    const actions = (list: PrimitiveInstruction[], offset: number): RunResult | null => {
      for (let k = 0; k < list.length; k += 1) {
        const result = step(list[k]!.op, [...path, offset + k], round, call);
        if (result) return result;
      }
      return null;
    };
    if (sensor(node["when"] as string)) return actions(then, 0);
    if (other.length === 1 && other[0]!["op"] === IF_OP) {
      return runIf(other[0]!, [...path, then.length], round, call);
    }
    return actions(other as unknown as PrimitiveInstruction[], then.length);
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
    if (isActionNode(node)) return step(node.op, path, round, call);
    if (op === IF_OP) return runIf(node, path, round, call);

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
      const rounds = node["count"] === COUNTER_REF ? counter : (node["count"] as number);
      for (let r = 1; r <= rounds; r += 1) {
        for (let j = 0; j < body.length; j += 1) {
          const result = run(body[j]!, [...path, j], r, call);
          if (result) return result;
        }
      }
      return null;
    }

    // REPEAT_UNTIL
    for (let r = 1; ; r += 1) {
      if (node["until"] === "BLOCKED" && !sensor("CLEAR_AHEAD")) return null;
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
      if (!runnable(node, TOP, noProcs)) return finish("FAILED", "INVALID_INSTRUCTION", null);
      continue;
    }
    if (atLimit()) return finish("FAILED", "STEP_LIMIT", null);
    if (!runnable(node, TOP, procs)) return finish("FAILED", "INVALID_INSTRUCTION", null);
    const result = run(node as Node, [i], null, null);
    if (result) return result;
  }

  return finish("FAILED", "PROGRAM_ENDED", null);
}
