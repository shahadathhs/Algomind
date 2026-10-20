import type { Instruction, LevelContent } from "./admin-api";
import { slotsOf } from "./level-model";
import { countKinds } from "./program-model";

export type Change = { field: string; from: string; to: string };

type Version = { content: LevelContent; referenceSolution: Instruction[] };

/** The reference solution in a few words: its slots, and how many loops and ifs it uses. */
function solutionText(program: Instruction[]): string {
  const { counted, until, ifs } = countKinds(program);
  const slots = `${slotsOf(program)} slot${slotsOf(program) === 1 ? "" : "s"}`;
  if (counted + until + ifs === 0) return `${slots}, no loops`;
  const parts: string[] = [];
  if (counted > 0) parts.push(`${counted} loop${counted === 1 ? "" : "s"}`);
  if (until > 0) parts.push(`${until} until-loop${until === 1 ? "" : "s"}`);
  if (ifs > 0) parts.push(`${ifs} if${ifs === 1 ? "" : "s"}`);
  return `${slots}, ${parts.join(", ")}`;
}

function describe(version: Version | null): Record<string, string> {
  if (!version) return {};
  const { content, referenceSolution } = version;
  return {
    Title: content.title,
    Description: content.description || "None",
    Difficulty: content.difficulty,
    "Board size": `${content.board.width} by ${content.board.height}`,
    Walls: String(content.board.walls.length),
    Start: `${content.initialState.position.join(", ")} facing ${content.initialState.direction}`,
    Goal: content.goal.position.join(", "),
    Commands: content.availableCommands.join(", "),
    "Max commands": String(content.constraints.maxCommands),
    "Max steps": String(content.constraints.maxSteps),
    Hints: content.hints.length ? content.hints.join(" / ") : "None",
    Solution: solutionText(referenceSolution),
  };
}

/** The field-by-field differences between the live version and the draft. */
export function diff(live: Version | null, draft: Version): Change[] {
  const before = describe(live);
  const after = describe(draft);
  const changes: Change[] = [];
  for (const field of Object.keys(after)) {
    const from = before[field] ?? "Not published";
    const to = after[field]!;
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}
