import type { BodyNode, IfNode, Instruction, Primitive } from "./admin-api";
import { PROCEDURE_NAMES } from "@algomind/level-contract";
import { COMMANDS, commandOf, isIf, isLoop, isProc } from "./level-model";
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
  const n = node as Instruction;
  if (isIf(node))
    return [
      own,
      ...(n.then ?? []).map((p) => commandOf(p.op)),
      ...(n.else ?? []).map((p) => commandOf(p.op)),
    ];
  // A loop and a PROC both hold a body: the definition's tiles come from the PROC, a CALL is one tile.
  if (isLoop(node) || isProc(node)) return [own, ...(n.body ?? []).flatMap(nodeTiles)];
  return [own];
}

/** The tape tiles for a program. */
export function tileCommands(program: Instruction[]): Command[] {
  return program.flatMap(nodeTiles);
}

/** The names of the procedures the program defines, each once, in order of appearance. */
export function definedNames(program: Instruction[]): string[] {
  const names = program.filter(isProc).map((n) => n.name ?? "");
  return names.filter((name, i) => name !== "" && names.indexOf(name) === i);
}

/** The first of A, B, C that no PROC uses yet, or null when all three are defined. */
export function nextFreeName(program: Instruction[]): string | null {
  const used = definedNames(program);
  return PROCEDURE_NAMES.find((name) => !used.includes(name)) ?? null;
}

export function newProc(name: string): Instruction {
  return { op: "PROC", name, body: [] };
}

export function newCall(name: string): Instruction {
  return { op: "CALL", name };
}

function visit(items: readonly BodyNode[] | undefined, fn: (node: Instruction) => void) {
  for (const item of items ?? []) {
    fn(item as Instruction);
    visit((item as Instruction).body, fn);
  }
}

/** The reference solution in words: loops, until-loops, ifs, procedures and calls, wherever they stand. */
export function countKinds(program: Instruction[]) {
  const counts = { counted: 0, until: 0, ifs: 0, procs: 0, calls: 0 };
  visit(program, (node) => {
    if (node.op === "REPEAT") counts.counted += 1;
    else if (node.op === "REPEAT_UNTIL") counts.until += 1;
    else if (node.op === "IF") counts.ifs += 1;
    else if (node.op === "PROC") counts.procs += 1;
    else if (node.op === "CALL") counts.calls += 1;
  });
  return counts;
}

export type { Primitive };

/** The row text of a node: its name, with the condition for an until-loop or an IF, or the name of a procedure. */
export function nodeLabel(node: {
  op: string;
  until?: string;
  when?: string;
  name?: string;
}): string {
  if (node.op === "PROC") return `Procedure ${node.name ?? ""}`.trim();
  if (node.op === "CALL") return `Call ${node.name ?? ""}`.trim();
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
