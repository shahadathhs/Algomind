/** Schema version this package reads and writes. Anything else is rejected. */
export const SCHEMA_VERSION = 1;

/** The commands that move or turn the automaton, in the canonical order used by the solver. */
export const PRIMITIVE_COMMANDS = ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT"] as const;

/** The loop instruction: a count and a body of primitives. */
export const REPEAT_OP = "REPEAT";

/** The conditional loop: it runs its body while the way ahead is open. */
export const REPEAT_UNTIL_OP = "REPEAT_UNTIL";

/** The conditions a REPEAT_UNTIL can wait for. BLOCKED: a wall or the board edge is straight ahead. */
export const UNTIL_CONDITIONS = ["BLOCKED"] as const;

/** Every command a level can offer, in the canonical order. */
export const COMMAND_NAMES = [...PRIMITIVE_COMMANDS, REPEAT_OP, REPEAT_UNTIL_OP] as const;

/** Directions in clockwise order starting at north. */
export const DIRECTIONS = ["north", "east", "south", "west"] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const GOAL_TYPES = ["reach_tile"] as const;

/** Unit step for each direction. x grows right, y grows down (0,0 is the top-left cell). */
export const DIRECTION_DELTAS = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
} as const;

/** Inclusive limits enforced by the validator. The JSON Schema repeats them; a test keeps both in sync. */
export const LIMITS = {
  boardSide: { min: 3, max: 12 },
  maxWalls: 100,
  maxCommands: { min: 1, max: 64 },
  maxSteps: { min: 1, max: 1000 },
  /** Instructions in a REPEAT body, and the number of repetitions. A loop cannot contain a loop. */
  repeatBody: { min: 1, max: 8 },
  repeatCount: { min: 2, max: 11 },
  levelVersion: { min: 1, max: 1_000_000 },
  /** Lengths are counted in Unicode code points. */
  levelId: { min: 1, max: 64 },
  slug: { min: 1, max: 64 },
  title: { min: 1, max: 60 },
  description: { min: 0, max: 280 },
  hints: { maxCount: 5, itemLength: { min: 1, max: 140 } },
  mechanics: { maxCount: 8, itemLength: { min: 1, max: 32 } },
} as const;

/** Lowercase letters and digits in groups separated by single hyphens. Used by levelId and slug. */
export const ID_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";
/** Lowercase letter first, then lowercase letters, digits, and underscores. Used by mechanic names. */
export const MECHANIC_PATTERN = "^[a-z][a-z0-9_]*$";
