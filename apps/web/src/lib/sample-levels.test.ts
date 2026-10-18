import { describe, expect, it } from "vitest";
import { type BoardData, type Dir, hasPoint } from "@/lib/board";
import { SAMPLE_LEVELS } from "@/lib/sample-levels";
import { FAILED_BOARD, READY_BOARD, RUNNING_BOARD, SOLVED_BOARD } from "@/lib/sample-screens";

const DELTA: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const LEFT: Record<Dir, Dir> = { N: "W", W: "S", S: "E", E: "N" };
const RIGHT: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };

/** Test-only breadth-first search over (cell, facing): is the goal reachable with the 3 commands? */
function solvable(board: BoardData): boolean {
  const seen = new Set<string>();
  const queue = [board.automaton];
  while (queue.length > 0) {
    const s = queue.shift()!;
    const key = `${s.x},${s.y},${s.dir}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (s.x === board.goal.x && s.y === board.goal.y) return true;
    queue.push({ ...s, dir: LEFT[s.dir] }, { ...s, dir: RIGHT[s.dir] });
    const [dx, dy] = DELTA[s.dir];
    const next = { x: s.x + dx, y: s.y + dy, dir: s.dir };
    const inside = next.x >= 0 && next.y >= 0 && next.x < board.width && next.y < board.height;
    if (inside && !hasPoint(board.walls, next)) queue.push(next);
  }
  return false;
}

describe("sample boards", () => {
  it("are all solvable and keep the automaton and goal off the walls", () => {
    for (const level of SAMPLE_LEVELS) {
      expect(solvable(level.board), level.id).toBe(true);
      expect(hasPoint(level.board.walls, level.board.automaton), level.id).toBe(false);
      expect(hasPoint(level.board.walls, level.board.goal), level.id).toBe(false);
    }
  });

  it("have unique ids", () => {
    expect(new Set(SAMPLE_LEVELS.map((l) => l.id)).size).toBe(SAMPLE_LEVELS.length);
  });
});

describe("sample screen frames", () => {
  it("are consistent with one level", () => {
    expect(solvable(READY_BOARD)).toBe(true);
    for (const frame of [RUNNING_BOARD, FAILED_BOARD, SOLVED_BOARD]) {
      expect(frame.walls).toEqual(READY_BOARD.walls);
      expect(frame.goal).toEqual(READY_BOARD.goal);
      expect(hasPoint(frame.walls, frame.automaton)).toBe(false);
    }
    expect(hasPoint(FAILED_BOARD.walls, FAILED_BOARD.hitWall!)).toBe(true);
  });
});
