import type { Program } from "./types.js";

/**
 * The command budget a program uses: a primitive is 1 slot, a REPEAT or REPEAT_UNTIL is 1 plus the instructions in its body.
 * Compare it with `constraints.maxCommands` and with par (`solve(...).commands`).
 */
export function programSlots(program: Program): number {
  let slots = 0;
  for (const node of program) slots += "body" in node ? 1 + node.body.length : 1;
  return slots;
}
