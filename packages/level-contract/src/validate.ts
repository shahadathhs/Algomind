import {
  COMMAND_NAMES,
  REPEAT_OP,
  DIFFICULTIES,
  DIRECTIONS,
  GOAL_TYPES,
  ID_PATTERN,
  LIMITS,
  MECHANIC_PATTERN,
  SCHEMA_VERSION,
} from "./constants.js";
import type { CommandName, Issue, IssueCode, Level, ValidationResult } from "./types.js";

type Obj = Record<string, unknown>;

const ID_RE = new RegExp(ID_PATTERN);
const MECHANIC_RE = new RegExp(MECHANIC_PATTERN);

const PUBLIC_KEYS = [
  "schemaVersion",
  "levelId",
  "levelVersion",
  "slug",
  "title",
  "description",
  "difficulty",
  "requires",
  "board",
  "initialState",
  "availableCommands",
  "constraints",
  "goal",
  "hints",
];

function isObject(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function has(o: Obj, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key);
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v);
}

function isCommandName(v: unknown): v is CommandName {
  return typeof v === "string" && (COMMAND_NAMES as readonly string[]).includes(v);
}

function codePoints(s: string): number {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

function join(base: string, key: string): string {
  return base === "" ? key : `${base}.${key}`;
}

class Collector {
  issues: Issue[] = [];
  add(path: string, code: IssueCode, message: string): void {
    this.issues.push({ path, code, message });
  }
}

/** Reads a required field; reports REQUIRED when absent. */
function field(c: Collector, o: Obj, base: string, key: string): unknown {
  if (!has(o, key)) {
    c.add(join(base, key), "REQUIRED", `${join(base, key)} is required.`);
    return undefined;
  }
  return o[key];
}

/** Reports every key of `o` that is not in `allowed`. */
function rejectUnknown(c: Collector, o: Obj, base: string, allowed: readonly string[]): void {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) {
      c.add(join(base, key), "UNKNOWN_FIELD", `${join(base, key)} is not a known field.`);
    }
  }
}

/** Reads a required object field. Returns null (after reporting) when absent or not an object. */
function objectField(c: Collector, o: Obj, base: string, key: string): Obj | null {
  const v = field(c, o, base, key);
  if (v === undefined && !has(o, key)) return null;
  if (!isObject(v)) {
    c.add(join(base, key), "INVALID_TYPE", `${join(base, key)} must be an object.`);
    return null;
  }
  return v;
}

function intField(
  c: Collector,
  o: Obj,
  base: string,
  key: string,
  min: number,
  max: number,
): number | null {
  const path = join(base, key);
  if (!has(o, key)) {
    c.add(path, "REQUIRED", `${path} is required.`);
    return null;
  }
  const v = o[key];
  if (!isInt(v)) {
    c.add(path, "INVALID_TYPE", `${path} must be an integer.`);
    return null;
  }
  if (v < min || v > max) {
    c.add(path, "OUT_OF_RANGE", `${path} must be between ${min} and ${max}.`);
    return null;
  }
  return v;
}

function stringField(
  c: Collector,
  o: Obj,
  base: string,
  key: string,
  min: number,
  max: number,
  pattern?: RegExp,
): string | null {
  const path = join(base, key);
  if (!has(o, key)) {
    c.add(path, "REQUIRED", `${path} is required.`);
    return null;
  }
  return checkString(c, o[key], path, min, max, pattern);
}

function checkString(
  c: Collector,
  v: unknown,
  path: string,
  min: number,
  max: number,
  pattern?: RegExp,
): string | null {
  if (typeof v !== "string") {
    c.add(path, "INVALID_TYPE", `${path} must be a string.`);
    return null;
  }
  const len = codePoints(v);
  if (len < min || len > max) {
    c.add(path, "LENGTH_OUT_OF_RANGE", `${path} must be ${min} to ${max} characters long.`);
    return null;
  }
  if (pattern && !pattern.test(v)) {
    c.add(path, "INVALID_FORMAT", `${path} has an invalid format.`);
    return null;
  }
  return v;
}

function enumField(
  c: Collector,
  o: Obj,
  base: string,
  key: string,
  allowed: readonly string[],
): string | null {
  const path = join(base, key);
  if (!has(o, key)) {
    c.add(path, "REQUIRED", `${path} is required.`);
    return null;
  }
  const v = o[key];
  if (typeof v !== "string") {
    c.add(path, "INVALID_TYPE", `${path} must be a string.`);
    return null;
  }
  if (!allowed.includes(v)) {
    c.add(path, "INVALID_VALUE", `${path} must be one of: ${allowed.join(", ")}.`);
    return null;
  }
  return v;
}

/**
 * Checks that `v` is a pair [x, y] of integers. Reports INVALID_TYPE otherwise and returns null.
 * When the board size is known and the cell lies outside it, reports OUTSIDE_BOARD but still returns the pair
 * so the later wall / start / goal comparisons can run.
 */
function checkPair(
  c: Collector,
  v: unknown,
  path: string,
  size: { width: number; height: number } | null,
): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2 || !isInt(v[0]) || !isInt(v[1])) {
    c.add(path, "INVALID_TYPE", `${path} must be a pair [x, y] of integers.`);
    return null;
  }
  const x = v[0];
  const y = v[1];
  if (size && (x < 0 || y < 0 || x >= size.width || y >= size.height)) {
    c.add(
      path,
      "OUTSIDE_BOARD",
      `${path} must be inside the ${size.width} by ${size.height} board.`,
    );
  }
  return [x, y];
}

function samePair(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function validateBoardAndCells(c: Collector, root: Obj): void {
  const board = objectField(c, root, "", "board");
  let size: { width: number; height: number } | null = null;
  let walls: ([number, number] | null)[] = [];
  if (board) {
    rejectUnknown(c, board, "board", ["width", "height", "walls"]);
    const side = LIMITS.boardSide;
    const width = intField(c, board, "board", "width", side.min, side.max);
    const height = intField(c, board, "board", "height", side.min, side.max);
    if (width !== null && height !== null) size = { width, height };
    walls = validateWalls(c, board, size);
  }

  const wellFormedWalls = walls.filter((w): w is [number, number] => w !== null);

  const initial = objectField(c, root, "", "initialState");
  let start: [number, number] | null = null;
  if (initial) {
    rejectUnknown(c, initial, "initialState", ["position", "direction"]);
    if (has(initial, "position")) {
      start = checkPair(c, initial["position"], "initialState.position", size);
    } else {
      c.add("initialState.position", "REQUIRED", "initialState.position is required.");
    }
    enumField(c, initial, "initialState", "direction", DIRECTIONS);
  }

  const goal = objectField(c, root, "", "goal");
  let goalPos: [number, number] | null = null;
  if (goal) {
    rejectUnknown(c, goal, "goal", ["type", "position"]);
    enumField(c, goal, "goal", "type", GOAL_TYPES);
    if (has(goal, "position")) {
      goalPos = checkPair(c, goal["position"], "goal.position", size);
    } else {
      c.add("goal.position", "REQUIRED", "goal.position is required.");
    }
  }

  if (start && wellFormedWalls.some((w) => samePair(w, start))) {
    c.add("initialState.position", "START_ON_WALL", "The start cell must not be a wall.");
  }
  if (goalPos && wellFormedWalls.some((w) => samePair(w, goalPos))) {
    c.add("goal.position", "GOAL_ON_WALL", "The goal cell must not be a wall.");
  }
  if (start && goalPos && samePair(start, goalPos)) {
    c.add("goal.position", "GOAL_EQUALS_START", "The goal cell must differ from the start cell.");
  }
}

/** Returns one entry per wall: the pair, or null when that entry is malformed. */
function validateWalls(
  c: Collector,
  board: Obj,
  size: { width: number; height: number } | null,
): ([number, number] | null)[] {
  if (!has(board, "walls")) {
    c.add("board.walls", "REQUIRED", "board.walls is required.");
    return [];
  }
  const raw = board["walls"];
  if (!Array.isArray(raw)) {
    c.add("board.walls", "INVALID_TYPE", "board.walls must be an array.");
    return [];
  }
  if (raw.length > LIMITS.maxWalls) {
    c.add(
      "board.walls",
      "LENGTH_OUT_OF_RANGE",
      `board.walls must have at most ${LIMITS.maxWalls} entries.`,
    );
  }
  const out: ([number, number] | null)[] = [];
  const seen: [number, number][] = [];
  raw.forEach((entry, i) => {
    const path = `board.walls[${i}]`;
    const pair = checkPair(c, entry, path, size);
    out.push(pair);
    if (pair) {
      if (seen.some((s) => samePair(s, pair))) {
        c.add(path, "DUPLICATE_WALL", `${path} repeats an earlier wall.`);
      } else {
        seen.push(pair);
      }
    }
  });
  return out;
}

function validateCommands(c: Collector, root: Obj): void {
  if (!has(root, "availableCommands")) {
    c.add("availableCommands", "REQUIRED", "availableCommands is required.");
    return;
  }
  const raw = root["availableCommands"];
  if (!Array.isArray(raw)) {
    c.add("availableCommands", "INVALID_TYPE", "availableCommands must be an array.");
    return;
  }
  if (raw.length < 1) {
    c.add("availableCommands", "LENGTH_OUT_OF_RANGE", "availableCommands must not be empty.");
  }
  const seen: string[] = [];
  raw.forEach((item, i) => {
    const path = `availableCommands[${i}]`;
    if (typeof item !== "string") {
      c.add(path, "INVALID_TYPE", `${path} must be a string.`);
    } else if (!isCommandName(item)) {
      c.add(path, "UNKNOWN_COMMAND", `${path} is not a known command.`);
    } else if (seen.includes(item)) {
      c.add(path, "DUPLICATE_COMMAND", `${path} repeats an earlier command.`);
    } else {
      seen.push(item);
    }
  });
}

function validateRequires(c: Collector, root: Obj): void {
  const requires = objectField(c, root, "", "requires");
  if (!requires) return;
  rejectUnknown(c, requires, "requires", ["mechanics"]);
  if (!has(requires, "mechanics")) {
    c.add("requires.mechanics", "REQUIRED", "requires.mechanics is required.");
    return;
  }
  const raw = requires["mechanics"];
  if (!Array.isArray(raw)) {
    c.add("requires.mechanics", "INVALID_TYPE", "requires.mechanics must be an array.");
    return;
  }
  const lim = LIMITS.mechanics;
  if (raw.length > lim.maxCount) {
    c.add(
      "requires.mechanics",
      "LENGTH_OUT_OF_RANGE",
      `requires.mechanics must have at most ${lim.maxCount} entries.`,
    );
  }
  const seen: string[] = [];
  raw.forEach((item, i) => {
    const path = `requires.mechanics[${i}]`;
    const s = checkString(c, item, path, lim.itemLength.min, lim.itemLength.max, MECHANIC_RE);
    if (s === null) return;
    if (seen.includes(s)) {
      c.add(path, "DUPLICATE_MECHANIC", `${path} repeats an earlier mechanic.`);
    } else {
      seen.push(s);
    }
  });
}

function validateConstraints(c: Collector, root: Obj): void {
  const constraints = objectField(c, root, "", "constraints");
  if (!constraints) return;
  rejectUnknown(c, constraints, "constraints", ["maxCommands", "maxSteps"]);
  intField(
    c,
    constraints,
    "constraints",
    "maxCommands",
    LIMITS.maxCommands.min,
    LIMITS.maxCommands.max,
  );
  intField(c, constraints, "constraints", "maxSteps", LIMITS.maxSteps.min, LIMITS.maxSteps.max);
}

function validateHints(c: Collector, root: Obj): void {
  if (!has(root, "hints")) {
    c.add("hints", "REQUIRED", "hints is required.");
    return;
  }
  const raw = root["hints"];
  if (!Array.isArray(raw)) {
    c.add("hints", "INVALID_TYPE", "hints must be an array.");
    return;
  }
  const lim = LIMITS.hints;
  if (raw.length > lim.maxCount) {
    c.add("hints", "LENGTH_OUT_OF_RANGE", `hints must have at most ${lim.maxCount} entries.`);
  }
  raw.forEach((item, i) => {
    checkString(c, item, `hints[${i}]`, lim.itemLength.min, lim.itemLength.max);
  });
}

function validateLevelWith(input: unknown, authoring: boolean): ValidationResult {
  const c = new Collector();
  try {
    run(c, input, authoring);
  } catch {
    // Defensive: validation never throws on any input (for example a hostile getter or Proxy).
    c.add("", "INVALID_TYPE", "The level could not be read.");
  }
  return { ok: c.issues.length === 0, issues: c.issues };
}

function run(c: Collector, input: unknown, authoring: boolean): void {
  if (!isObject(input)) {
    c.add("", "INVALID_TYPE", "The level must be an object.");
    return;
  }

  // An unsupported schema version is rejected on its own: nothing else can be trusted.
  if (has(input, "schemaVersion") && isInt(input["schemaVersion"])) {
    if (input["schemaVersion"] !== SCHEMA_VERSION) {
      c.add(
        "schemaVersion",
        "UNSUPPORTED_SCHEMA_VERSION",
        `schemaVersion ${input["schemaVersion"]} is not supported; expected ${SCHEMA_VERSION}.`,
      );
      return;
    }
  } else if (has(input, "schemaVersion")) {
    c.add("schemaVersion", "INVALID_TYPE", "schemaVersion must be an integer.");
  } else {
    c.add("schemaVersion", "REQUIRED", "schemaVersion is required.");
  }

  rejectUnknown(c, input, "", authoring ? [...PUBLIC_KEYS, "referenceSolution"] : PUBLIC_KEYS);

  const ids = LIMITS.levelId;
  stringField(c, input, "", "levelId", ids.min, ids.max, ID_RE);
  intField(c, input, "", "levelVersion", LIMITS.levelVersion.min, LIMITS.levelVersion.max);
  stringField(c, input, "", "slug", LIMITS.slug.min, LIMITS.slug.max, ID_RE);
  stringField(c, input, "", "title", LIMITS.title.min, LIMITS.title.max);
  stringField(c, input, "", "description", LIMITS.description.min, LIMITS.description.max);
  enumField(c, input, "", "difficulty", DIFFICULTIES);
  validateRequires(c, input);
  validateBoardAndCells(c, input);
  validateCommands(c, input);
  validateConstraints(c, input);
  validateHints(c, input);

  if (authoring) {
    if (!has(input, "referenceSolution")) {
      c.add("referenceSolution", "REQUIRED", "referenceSolution is required.");
    } else {
      checkProgram(c, input["referenceSolution"], "referenceSolution", programLimits(input));
    }
  }
}

/** Best-effort read of availableCommands / maxCommands from a level that may have other problems. */
function programLimits(level: unknown): { available: CommandName[] | null; max: number | null } {
  if (!isObject(level)) return { available: null, max: null };
  let available: CommandName[] | null = null;
  if (Array.isArray(level["availableCommands"])) {
    available = level["availableCommands"].filter(isCommandName);
  }
  let max: number | null = null;
  const constraints = level["constraints"];
  if (isObject(constraints) && isInt(constraints["maxCommands"])) max = constraints["maxCommands"];
  return { available, max };
}

function checkProgram(
  c: Collector,
  program: unknown,
  base: string,
  limits: { available: CommandName[] | null; max: number | null },
): void {
  if (!Array.isArray(program)) {
    c.add(base, "INVALID_TYPE", `${base} must be an array of instructions.`);
    return;
  }
  // Slots: a primitive is 1; a REPEAT is 1 plus the instructions in its body.
  let slots = 0;
  const checkOp = (node: Obj, path: string, inBody: boolean): CommandName | null => {
    const opPath = `${path}.op`;
    if (!has(node, "op")) {
      c.add(opPath, "REQUIRED", `${opPath} is required.`);
      return null;
    }
    const op = node["op"];
    if (typeof op !== "string") {
      c.add(opPath, "INVALID_TYPE", `${opPath} must be a string.`);
      return null;
    }
    if (!isCommandName(op)) {
      c.add(opPath, "UNKNOWN_COMMAND", `${opPath} is not a known command.`);
      return null;
    }
    if (inBody && op === REPEAT_OP) {
      c.add(opPath, "NESTED_REPEAT", `${opPath}: a loop cannot contain a loop.`);
      return null;
    }
    if (limits.available && !limits.available.includes(op)) {
      c.add(opPath, "COMMAND_NOT_AVAILABLE", `${op} is not available in this level.`);
    }
    return op;
  };

  program.forEach((node, i) => {
    const path = `${base}[${i}]`;
    if (!isObject(node)) {
      c.add(path, "INVALID_TYPE", `${path} must be an instruction object.`);
      slots += 1;
      return;
    }
    const op = typeof node["op"] === "string" ? node["op"] : null;
    rejectUnknown(c, node, path, op === REPEAT_OP ? ["op", "count", "body"] : ["op"]);
    const known = checkOp(node, path, false);
    slots += 1;
    if (known !== REPEAT_OP) return;

    const countPath = `${path}.count`;
    if (!has(node, "count")) {
      c.add(countPath, "REQUIRED", `${countPath} is required.`);
    } else if (!isInt(node["count"])) {
      c.add(countPath, "INVALID_TYPE", `${countPath} must be an integer.`);
    } else if (node["count"] < LIMITS.repeatCount.min || node["count"] > LIMITS.repeatCount.max) {
      c.add(
        countPath,
        "OUT_OF_RANGE",
        `${countPath} must be from ${LIMITS.repeatCount.min} to ${LIMITS.repeatCount.max}.`,
      );
    }

    const bodyPath = `${path}.body`;
    if (!has(node, "body")) {
      c.add(bodyPath, "REQUIRED", `${bodyPath} is required.`);
      return;
    }
    const body = node["body"];
    if (!Array.isArray(body)) {
      c.add(bodyPath, "INVALID_TYPE", `${bodyPath} must be an array of instructions.`);
      return;
    }
    if (body.length < LIMITS.repeatBody.min || body.length > LIMITS.repeatBody.max) {
      c.add(
        bodyPath,
        "LENGTH_OUT_OF_RANGE",
        `${bodyPath} must have ${LIMITS.repeatBody.min} to ${LIMITS.repeatBody.max} instructions.`,
      );
    }
    slots += body.length;
    body.forEach((inner, j) => {
      const innerPath = `${bodyPath}[${j}]`;
      if (!isObject(inner)) {
        c.add(innerPath, "INVALID_TYPE", `${innerPath} must be an instruction object.`);
        return;
      }
      // A nested loop is reported once, as NESTED_REPEAT, not field by field.
      if (inner["op"] !== REPEAT_OP) rejectUnknown(c, inner, innerPath, ["op"]);
      checkOp(inner, innerPath, true);
    });
  });
  if (limits.max !== null && slots > limits.max) {
    c.add(
      base,
      "TOO_MANY_COMMANDS",
      `${base} uses ${slots} slots; this level allows ${limits.max}.`,
    );
  }
}

/** Validates a public level definition (no `referenceSolution` allowed). Never throws. */
export function validateLevel(input: unknown): ValidationResult {
  return validateLevelWith(input, false);
}

/** Validates an authoring level: the public definition plus a required `referenceSolution`. Never throws. */
export function validateAuthoringLevel(input: unknown): ValidationResult {
  return validateLevelWith(input, true);
}

/**
 * Validates a program against a (valid) level: every instruction is well formed, its op is known and listed in
 * `availableCommands`, and the program is no longer than `constraints.maxCommands`. An empty program is valid.
 * Never throws.
 */
export function validateProgram(level: Level, program: unknown): ValidationResult {
  const c = new Collector();
  try {
    checkProgram(c, program, "program", programLimits(level));
  } catch {
    c.add("program", "INVALID_TYPE", "The program could not be read.");
  }
  return { ok: c.issues.length === 0, issues: c.issues };
}
