import type { Instruction, Program } from "./types.js";

function nodeSlots(node: Instruction): number {
  if (node.op === "IF") return 1 + node.then.length + node.else.length;
  if ("body" in node) return 1 + node.body.reduce((sum, item) => sum + nodeSlots(item), 0);
  return 1;
}

/**
 * The command budget a program uses: a primitive and a CALL are 1 slot; a loop, a PROC and an IF are 1
 * plus what they hold (the slots of the body items, or the primitives of the two branches). Compare it
 * with `constraints.maxCommands` and with par.
 */
export function programSlots(program: Program): number {
  return program.reduce((sum, node) => sum + nodeSlots(node), 0);
}
