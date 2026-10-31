import { DIRECTIONS, PRIMITIVE_COMMANDS, REPEAT_OP, REPEAT_UNTIL_OP } from "./constants.js";
import { patrolMeeting } from "./patrol.js";
import { cellAhead, isInsideBoard, isWall, turn } from "./simulate.js";
import type { Direction, Level, Position, PrimitiveName, Program, SolveResult } from "./types.js";
import { solveWithRepeat } from "./solve-repeat.js";

interface Node {
  x: number;
  y: number;
  dir: number; // index into DIRECTIONS
  parent: number; // index into the node list, -1 for the start
  op: PrimitiveName | null; // the command that produced this node
  held?: number; // bit i is set when the key of lock i is held (levels with keys)
  carry?: number; // the item being carried plus one, 0 for empty hands (levels with deliveries)
  done?: number; // bit i is set when delivery i is delivered
}

/**
 * Finds the shortest program (par) for the level, or null when the goal cannot be reached.
 *
 * Breadth-first search over states (x, y, facing). Tie-breaking, so any language can reproduce the exact
 * program and not only its length:
 *  1. The queue is FIFO and starts with the initial state.
 *  2. A state taken from the queue is expanded by trying the commands in the fixed order
 *     MOVE_FORWARD, TURN_LEFT, TURN_RIGHT, skipping commands not in `availableCommands`.
 *  3. A state is recorded the first time it is discovered; later discoveries are ignored.
 *  4. MOVE_FORWARD produces no state when the target is off the board or a wall.
 *  5. The search stops at the first discovered state whose cell is the goal; the program is the path to it.
 *
 * `fitsConstraints` reports whether that program obeys `maxCommands` and `maxSteps`; the search itself
 * ignores both. Expects a level that passed `validateLevel`.
 */
export function solve(level: Level): SolveResult | null {
  // Only a target can be searched for; the sweep goal (visit_all) has no exact par.
  if (level.goal.type !== "reach_tile") return null;
  // Patrols make the state depend on the step number, so the search is over (x, y, facing, step).
  // Keys add the keys held to the state, so the same layered search serves them.
  if (hasPatrols(level) || hasLocks(level) || hasDeliveries(level)) return solveWithPatrols(level);
  if (
    level.availableCommands.includes(REPEAT_OP) ||
    level.availableCommands.includes(REPEAT_UNTIL_OP)
  ) {
    return solveWithRepeat(level);
  }
  const available = PRIMITIVE_COMMANDS.filter((c) => level.availableCommands.includes(c));
  const goal = level.goal.position;
  const { width, height } = level.board;
  const startDir = DIRECTIONS.indexOf(level.initialState.direction);

  const nodes: Node[] = [
    {
      x: level.initialState.position[0],
      y: level.initialState.position[1],
      dir: startDir,
      parent: -1,
      op: null,
    },
  ];
  const seen = new Set<number>([key(nodes[0]!.x, nodes[0]!.y, startDir, width, height)]);

  const finish = (last: number): SolveResult => {
    const ops: PrimitiveName[] = [];
    for (let i = last; i > 0; i = nodes[i]!.parent) ops.push(nodes[i]!.op as PrimitiveName);
    ops.reverse();
    const program: Program = ops.map((op) => ({ op }));
    return {
      commands: program.length,
      steps: program.length,
      program,
      fitsConstraints:
        program.length <= level.constraints.maxCommands &&
        program.length <= level.constraints.maxSteps,
    };
  };

  if (nodes[0]!.x === goal[0] && nodes[0]!.y === goal[1]) return finish(0);

  for (let head = 0; head < nodes.length; head += 1) {
    const cur = nodes[head]!;
    for (const op of available) {
      let x = cur.x;
      let y = cur.y;
      let dir = cur.dir;
      if (op === "MOVE_FORWARD") {
        const target: Position = cellAhead([x, y], DIRECTIONS[dir] as Direction);
        if (!isInsideBoard(level, target) || isWall(level, target)) continue;
        x = target[0];
        y = target[1];
      } else {
        dir = DIRECTIONS.indexOf(
          turn(DIRECTIONS[dir] as Direction, op === "TURN_LEFT" ? "left" : "right"),
        );
      }
      const k = key(x, y, dir, width, height);
      if (seen.has(k)) continue;
      seen.add(k);
      nodes.push({ x, y, dir, parent: head, op });
      if (x === goal[0] && y === goal[1]) return finish(nodes.length - 1);
    }
  }
  return null;
}

const samePosition = (a: Position, b: Position): boolean => a[0] === b[0] && a[1] === b[1];
const hasPatrols = (level: Level): boolean => (level.patrols ?? []).length > 0;
const hasLocks = (level: Level): boolean => (level.locks ?? []).length > 0;
const hasDeliveries = (level: Level): boolean => (level.deliveries ?? []).length > 0;

function key(x: number, y: number, dir: number, width: number, height: number): number {
  return (dir * height + y) * width + x;
}

/**
 * The shortest flat program for a level with patrols or keys: breadth first over states (x, y, facing, keys
 * held) layer by
 * layer, one layer per step, because where a patrol stands depends on the step. A command that would end
 * in a collision with a patrol (see `patrolMeeting`) is not tried; the goal is tested after that, as in
 * the simulator. Loops are not searched: with REPEAT on offer the API takes the better of this and the
 * reference solution. The same tie-breaking as `solve`: commands in the order MOVE_FORWARD, TURN_LEFT,
 * TURN_RIGHT, a state kept the first time it is found in a layer.
 */
function solveWithPatrols(level: Level): SolveResult | null {
  if (level.goal.type !== "reach_tile") return null;
  const available = PRIMITIVE_COMMANDS.filter((c) => level.availableCommands.includes(c));
  const goal = level.goal.position;
  const { width, height } = level.board;
  const locks = level.locks ?? [];
  const deliveries = level.deliveries ?? [];
  const everything = (1 << deliveries.length) - 1;
  const nodes: Node[] = [
    {
      x: level.initialState.position[0],
      y: level.initialState.position[1],
      dir: DIRECTIONS.indexOf(level.initialState.direction),
      parent: -1,
      op: null,
    },
  ];
  const finish = (last: number): SolveResult => {
    const ops: PrimitiveName[] = [];
    for (let i = last; i > 0; i = nodes[i]!.parent) ops.push(nodes[i]!.op as PrimitiveName);
    ops.reverse();
    const program: Program = ops.map((op) => ({ op }));
    return {
      commands: program.length,
      steps: program.length,
      program,
      fitsConstraints:
        program.length <= level.constraints.maxCommands &&
        program.length <= level.constraints.maxSteps,
    };
  };

  let layer = [0];
  for (let depth = 0; depth < level.constraints.maxSteps && layer.length > 0; depth += 1) {
    const next: number[] = [];
    const seen = new Set<number>();
    for (const head of layer) {
      const cur = nodes[head]!;
      for (const op of available) {
        let x = cur.x;
        let y = cur.y;
        let dir = cur.dir;
        let held = cur.held ?? 0;
        let carry = cur.carry ?? 0;
        let done = cur.done ?? 0;
        if (op === "MOVE_FORWARD") {
          const target: Position = cellAhead([x, y], DIRECTIONS[dir] as Direction);
          if (!isInsideBoard(level, target) || isWall(level, target)) continue;
          const door = locks.findIndex((lock) => samePosition(lock.door, target));
          if (door >= 0 && (held & (1 << door)) === 0) continue;
          x = target[0];
          y = target[1];
          const picked = locks.findIndex((lock) => samePosition(lock.key, target));
          if (picked >= 0) held |= 1 << picked;
          const dock = deliveries.findIndex((d) => samePosition(d.dock, target));
          const item = deliveries.findIndex((d) => samePosition(d.item, target));
          if (dock >= 0 && carry === dock + 1) {
            done |= 1 << dock;
            carry = 0;
          } else if (item >= 0 && carry === 0 && (done & (1 << item)) === 0) {
            carry = item + 1;
          }
        } else {
          dir = DIRECTIONS.indexOf(
            turn(DIRECTIONS[dir] as Direction, op === "TURN_LEFT" ? "left" : "right"),
          );
        }
        if (patrolMeeting(level, [cur.x, cur.y], [x, y], depth)) continue;
        const atGoal = x === goal[0] && y === goal[1];
        // Entering the target with an item left ends the run in failure, so it is no move to search.
        if (atGoal && done !== everything) continue;
        const extra = held | (done << 3) | (carry << 6);
        const k = key(x, y, dir, width, height) + extra * width * height * 4;
        if (seen.has(k)) continue;
        seen.add(k);
        nodes.push({ x, y, dir, parent: head, op, held, carry, done });
        if (atGoal) return finish(nodes.length - 1);
        next.push(nodes.length - 1);
      }
    }
    layer = next;
  }
  return null;
}
