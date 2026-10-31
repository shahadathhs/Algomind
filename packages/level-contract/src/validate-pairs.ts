import { LIMITS } from "./constants.js";
import type { IssueCode } from "./types.js";
import {
  boardFacts,
  checkPair,
  has,
  isInt,
  isObject,
  rejectUnknown,
  samePair,
  type Collector,
  type Obj,
} from "./validate.js";

type Field = "locks" | "deliveries" | "switches";

/** What differs between the kinds of paired cells on a board: keys and doors, items and docks, switches and gates. */
interface PairSpec {
  field: Field;
  parts: [string, string];
  noun: string;
  limits: { min: number; max: number };
  codes: Record<"wall" | "start" | "goal" | "repeat" | "boards" | "sweep", IssueCode>;
  /** The fields whose cells these may not share. */
  apart: Field[];
  /** An optional boolean on each entry. */
  flag?: string;
}

const SPECS: PairSpec[] = [
  {
    field: "locks",
    parts: ["key", "door"],
    noun: "keys and doors",
    limits: LIMITS.locks,
    apart: [],
    codes: {
      wall: "LOCK_ON_WALL",
      start: "LOCK_ON_START",
      goal: "LOCK_ON_GOAL",
      repeat: "LOCK_CELLS_REPEAT",
      boards: "LOCKS_WITH_BOARDS",
      sweep: "LOCKS_WITH_SWEEP",
    },
  },
  {
    field: "deliveries",
    parts: ["item", "dock"],
    noun: "deliveries",
    limits: LIMITS.deliveries,
    apart: ["locks"],
    codes: {
      wall: "DELIVERY_ON_WALL",
      start: "DELIVERY_ON_START",
      goal: "DELIVERY_ON_GOAL",
      repeat: "DELIVERY_CELLS_REPEAT",
      boards: "DELIVERIES_WITH_BOARDS",
      sweep: "DELIVERIES_WITH_SWEEP",
    },
  },
  {
    field: "switches",
    parts: ["switch", "gate"],
    noun: "switches and gates",
    limits: LIMITS.switches,
    apart: ["locks", "deliveries"],
    flag: "open",
    codes: {
      wall: "SWITCH_ON_WALL",
      start: "SWITCH_ON_START",
      goal: "SWITCH_ON_GOAL",
      repeat: "SWITCH_CELLS_REPEAT",
      boards: "SWITCHES_WITH_BOARDS",
      sweep: "SWITCHES_WITH_SWEEP",
    },
  },
];

const PART_NAMES: Record<Field, [string, string]> = {
  locks: ["key", "door"],
  deliveries: ["item", "dock"],
  switches: ["switch", "gate"],
};

/** Validates `locks`, `deliveries` and `switches`: pairs of cells on the level's own board, all different. */
export function validatePairs(c: Collector, root: Obj): void {
  for (const spec of SPECS) validateField(c, root, spec);
}

function validateField(c: Collector, root: Obj, spec: PairSpec): void {
  const { field, parts, noun, limits, codes } = spec;
  if (!has(root, field)) return;
  const raw = root[field];
  if (!Array.isArray(raw)) {
    c.add(field, "INVALID_TYPE", `${field} must be an array.`);
    return;
  }
  if (raw.length < limits.min || raw.length > limits.max) {
    c.add(
      field,
      "LENGTH_OUT_OF_RANGE",
      `${field} must have ${limits.min} to ${limits.max} entries, or be left out.`,
    );
  }
  if (has(root, "extraBoards")) {
    c.add(field, codes.boards, `A level with test boards cannot have ${noun}.`);
  }
  const goalType = isObject(root["goal"]) ? root["goal"]["type"] : undefined;
  if (goalType === "visit_all") {
    c.add(field, codes.sweep, `A level that sweeps every cell cannot have ${noun}.`);
  }
  const facts = boardFacts(root);
  const seen: [number, number][] = [];
  for (const other of spec.apart) {
    const entries = root[other];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      for (const part of PART_NAMES[other]) {
        const cell = isObject(entry) ? entry[part] : undefined;
        if (Array.isArray(cell) && cell.length === 2 && isInt(cell[0]) && isInt(cell[1])) {
          seen.push([cell[0], cell[1]]);
        }
      }
    }
  }
  raw.forEach((entry, i) => {
    const path = `${field}[${i}]`;
    if (!isObject(entry)) {
      c.add(path, "INVALID_TYPE", `${path} must be an object.`);
      return;
    }
    rejectUnknown(c, entry, path, spec.flag ? [...parts, spec.flag] : parts);
    if (spec.flag && has(entry, spec.flag) && typeof entry[spec.flag] !== "boolean") {
      c.add(`${path}.${spec.flag}`, "INVALID_TYPE", `${path}.${spec.flag} must be true or false.`);
    }
    for (const part of parts) {
      const cellPath = `${path}.${part}`;
      if (!has(entry, part)) {
        c.add(cellPath, "REQUIRED", `${cellPath} is required.`);
        continue;
      }
      const pair = checkPair(c, entry[part], cellPath, facts.size);
      if (!pair) continue;
      if (facts.walls.some((w) => samePair(w, pair))) {
        c.add(cellPath, codes.wall, `${cellPath} must not be a wall.`);
      }
      if (facts.start && samePair(facts.start, pair)) {
        c.add(cellPath, codes.start, `${cellPath} must not be the automaton's cell.`);
      }
      if (facts.goal && samePair(facts.goal, pair)) {
        c.add(cellPath, codes.goal, `${cellPath} must not be the target.`);
      }
      if (seen.some((s) => samePair(s, pair))) {
        c.add(cellPath, codes.repeat, `${cellPath} repeats an earlier cell of ${noun}.`);
      } else {
        seen.push(pair);
      }
    }
  });
}
