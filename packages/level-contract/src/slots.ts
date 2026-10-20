import type { BodyInstruction, Program } from "./types.js";

function nodeSlots(node: BodyInstruction | Program[number]): number {
  if (node.op === "IF") return 1 + node.then.length + node.else.length;
  if ("body" in node) return 1 + node.body.reduce((sum, item) => sum + nodeSlots(item), 0);
  return 1;
}

/**
 * The command budget a program uses: a primitive is 1 slot, a loop is 1 plus the slots of its body, and an
 * IF is 1 plus the primitives in its two branches. Compare it with `constraints.maxCommands` and with par.
 */
export function programSlots(program: Program): number {
  return program.reduce((sum, node) => sum + nodeSlots(node), 0);
}
