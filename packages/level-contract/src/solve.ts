import { DIRECTIONS, PRIMITIVE_COMMANDS, REPEAT_OP, REPEAT_UNTIL_OP } from "./constants.js";
import { cellAhead, isInsideBoard, isWall, turn } from "./simulate.js";
import type { Direction, Level, Position, PrimitiveName, Program, SolveResult } from "./types.js";
import { solveWithRepeat } from "./solve-repeat.js";

interface Node {
  x: number;
  y: number;
  dir: number; // index into DIRECTIONS
  parent: number; // index into the node list, -1 for the start
  op: PrimitiveName | null; // the command that produced this node
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

function key(x: number, y: number, dir: number, width: number, height: number): number {
  return (dir * height + y) * width + x;
}
