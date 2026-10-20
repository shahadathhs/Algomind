import type { COMMAND_NAMES, DIFFICULTIES, DIRECTIONS, PRIMITIVE_COMMANDS } from "./constants.js";

export type PrimitiveName = (typeof PRIMITIVE_COMMANDS)[number];
export type CommandName = (typeof COMMAND_NAMES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

/** [x, y]. x grows right, y grows down. */
export type Position = [number, number];

/** A move or a turn. */
export interface PrimitiveInstruction {
  op: PrimitiveName;
}
/** A loop: `body` runs `count` times. The body holds primitives only. */
export interface RepeatInstruction {
  op: "REPEAT";
  count: number;
  body: PrimitiveInstruction[];
}
/** One node of a program. Nodes (not bare strings) so a loop can hold a body. */
export type Instruction = PrimitiveInstruction | RepeatInstruction;
export type Program = Instruction[];

/** The public level definition served to the game. Never contains the reference solution. */
export interface Level {
  schemaVersion: 1;
  levelId: string;
  levelVersion: number;
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  requires: { mechanics: string[] };
  board: { width: number; height: number; walls: Position[] };
  initialState: { position: Position; direction: Direction };
  availableCommands: CommandName[];
  constraints: { maxCommands: number; maxSteps: number };
  goal: { type: "reach_tile"; position: Position };
  hints: string[];
}

/** The level as stored for authors: the public definition plus the reference solution. Never served publicly. */
export interface AuthoringLevel extends Level {
  referenceSolution: Program;
}

export type IssueCode =
  | "INVALID_TYPE"
  | "REQUIRED"
  | "UNKNOWN_FIELD"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "OUT_OF_RANGE"
  | "LENGTH_OUT_OF_RANGE"
  | "INVALID_FORMAT"
  | "INVALID_VALUE"
  | "OUTSIDE_BOARD"
  | "DUPLICATE_WALL"
  | "START_ON_WALL"
  | "GOAL_ON_WALL"
  | "GOAL_EQUALS_START"
  | "UNKNOWN_COMMAND"
  | "DUPLICATE_COMMAND"
  | "DUPLICATE_MECHANIC"
  | "COMMAND_NOT_AVAILABLE"
  | "TOO_MANY_COMMANDS"
  | "NESTED_REPEAT";

export interface Issue {
  /** JSON-pointer-like location, e.g. "board.width" or "board.walls[2]". "" is the document root. */
  path: string;
  /** Stable machine-readable code. */
  code: IssueCode;
  /** Human-readable text. Not part of the contract; do not match on it. */
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
}

export interface State {
  position: Position;
  direction: Direction;
}

export type RunStatus = "SUCCEEDED" | "FAILED";
export type RunReason =
  | "GOAL_REACHED"
  | "BLOCKED_BY_WALL"
  | "BLOCKED_BY_BOUNDARY"
  | "PROGRAM_ENDED"
  | "STEP_LIMIT"
  | "INVALID_INSTRUCTION";

export type TraceEvent =
  "MOVED" | "TURNED" | "GOAL_REACHED" | "BLOCKED_BY_WALL" | "BLOCKED_BY_BOUNDARY";

export interface TraceEntry {
  /** 0-based index of the executed step. */
  index: number;
  op: PrimitiveName;
  /** Where the instruction sits in the program: [i] at the top level, [i, j] inside the body of loop i. */
  node: number[];
  /** 1-based repetition of the loop the instruction ran in; null outside a loop. */
  round: number | null;
  /** State after the step. */
  position: Position;
  direction: Direction;
  event: TraceEvent;
}

export interface RunResult {
  status: RunStatus;
  reason: RunReason;
  /** Number of executed steps; always equals trace.length. */
  steps: number;
  finalState: State;
  /** The cell the automaton tried to enter, for the two BLOCKED reasons; otherwise null. */
  blockedCell: Position | null;
  trace: TraceEntry[];
}

export interface SolveResult {
  commands: number;
  steps: number;
  program: Program;
  /** True when commands <= constraints.maxCommands and steps <= constraints.maxSteps. */
  fitsConstraints: boolean;
}
