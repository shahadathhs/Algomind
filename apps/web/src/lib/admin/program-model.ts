import type { BodyNode, IfNode, Instruction, Primitive } from "./admin-api";
import { COMMANDS, commandOf, isIf, isLoop } from "./level-model";
import type { Command } from "@/lib/board";

export const SENSOR_LABELS: Record<string, string> = {
  CLEAR_AHEAD: "Clear ahead",
  CLEAR_LEFT: "Clear left",
  CLEAR_RIGHT: "Clear right",
};

export const UNTIL_LABELS: Record<string, string> = { BLOCKED: "Blocked", GOAL: "Goal" };

/** The branch limits of an IF (the contract's limits). */
export const IF_LIMITS = { then: { max: 4 }, else: { max: 4 } } as const;

export function newIf(): IfNode {
  return { op: "IF", when: "CLEAR_AHEAD", then: [], else: [] };
}

/** The tape tiles of one node: its own tile, then the tiles of what it holds. One tile per slot. */
function nodeTiles(node: BodyNode | Instruction): Command[] {
  const own = commandOf(node.op);
  if (isIf(node)) {
    const n = node as Instruction;
    return [
      own,
      ...(n.then ?? []).map((p) => commandOf(p.op)),
      ...(n.else ?? []).map((p) => commandOf(p.op)),
    ];
  }
  if (isLoop(node)) return [own, ...((node as Instruction).body ?? []).flatMap(nodeTiles)];
  return [own];
}

/** The tape tiles for a program. */
export function tileCommands(program: Instruction[]): Command[] {
  return program.flatMap(nodeTiles);
}

/** The reference solution in words: loops, until-loops and ifs, counting the ifs inside loop bodies. */
export function countKinds(program: Instruction[]) {
  const ifs = program.reduce(
    (sum, node) =>
      sum +
      (isIf(node) ? 1 : 0) +
      (isLoop(node) ? (node.body ?? []).filter((b) => isIf(b)).length : 0),
    0,
  );
  return {
    counted: program.filter((n) => n.op === "REPEAT").length,
    until: program.filter((n) => n.op === "REPEAT_UNTIL").length,
    ifs,
  };
}

export type { Primitive };

/** The row text of a node: its name, with the condition for an until-loop or an IF. */
export function nodeLabel(node: { op: string; until?: string; when?: string }): string {
  if (node.op === "REPEAT_UNTIL")
    return `Repeat until ${(UNTIL_LABELS[node.until ?? ""] ?? "").toLowerCase()}`.trim();
  if (node.op === "IF") return `If ${(SENSOR_LABELS[node.when ?? ""] ?? "").toLowerCase()}`.trim();
  return COMMANDS.find((c) => c.op === node.op)?.label ?? node.op;
}

/** The node as an IfNode, with empty branches for any field the saved data lacks. */
export function asIf(node: {
  op: string;
  when?: string;
  then?: Primitive[];
  else?: Primitive[];
}): IfNode {
  return {
    op: "IF",
    when: node.when ?? "CLEAR_AHEAD",
    then: node.then ?? [],
    else: node.else ?? [],
  };
}
