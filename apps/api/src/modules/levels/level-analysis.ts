import { createHash } from "node:crypto";
import {
  explainResult,
  programSlots,
  type AuthoringLevel,
  type CommandName,
  simulate,
  solve,
  validateAuthoringLevel,
} from "@algomind/level-contract";
import type { CheckIssue, Par } from "./levels.schemas.js";

/** The mechanic each command needs. A level always needs the mechanics of its available commands. */
export const COMMAND_MECHANICS: Record<CommandName, string> = {
  MOVE_FORWARD: "move",
  TURN_LEFT: "turn",
  TURN_RIGHT: "turn",
  REPEAT: "repeat",
  REPEAT_UNTIL: "repeat_until",
};

export type Analysis = {
  errors: CheckIssue[];
  warnings: CheckIssue[];
  par: Par | null;
  referenceSolved: boolean;
  /** Explicit requires.mechanics plus the mechanics implied by the available commands. */
  requiredMechanics: string[];
  /** Present only when the authoring level passed the validator. */
  level: AuthoringLevel | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON with object keys sorted at every depth, so equal content always serializes identically. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Hash of the level content that ties playtests to exact content. `levelVersion` is left out, so
 * restoring or re-drafting identical content keeps its playtests; the reference solution is not
 * part of what a tester plays.
 */
export function contentHash(content: unknown): string {
  const subject = isObject(content) ? { ...content, levelVersion: undefined } : content;
  return createHash("sha256").update(canonicalJson(subject)).digest("hex");
}

/**
 * Runs every content check: the contract validator, the reference solution through the reference
 * simulator, and the solver (par, budget versus par). Pure; never throws.
 */
export function analyzeLevel(content: unknown, referenceSolution: unknown): Analysis {
  const errors: CheckIssue[] = [];
  const warnings: CheckIssue[] = [];
  const candidate = isObject(content) ? { ...content, referenceSolution } : content;
  const validation = validateAuthoringLevel(candidate);
  if (!validation.ok) {
    for (const issue of validation.issues) errors.push({ gate: "validation", ...issue });
    return {
      errors,
      warnings,
      par: null,
      referenceSolved: false,
      requiredMechanics: [],
      level: null,
    };
  }

  const level = candidate as AuthoringLevel;
  const { referenceSolution: program, ...publicLevel } = level;

  const run = simulate(publicLevel, program);
  const referenceSolved = run.status === "SUCCEEDED";
  if (!referenceSolved) {
    errors.push({
      gate: "reference_solution",
      path: "referenceSolution",
      code: "REFERENCE_SOLUTION_FAILS",
      message: `The reference solution does not solve the level: ${explainResult(run)}`,
    });
  }

  let par: Par | null = null;
  const best = solve(publicLevel);
  if (!best) {
    errors.push({
      gate: "par",
      path: "goal.position",
      code: "GOAL_UNREACHABLE",
      message: "The goal cannot be reached with the available commands.",
    });
  } else {
    par = { commands: best.commands, steps: best.steps };
    if (best.commands > level.constraints.maxCommands) {
      errors.push({
        gate: "par",
        path: "constraints.maxCommands",
        code: "BUDGET_BELOW_PAR",
        message: `The command limit is ${level.constraints.maxCommands}, but the shortest solution needs ${best.commands}.`,
      });
    }
    if (best.steps > level.constraints.maxSteps) {
      errors.push({
        gate: "par",
        path: "constraints.maxSteps",
        code: "STEPS_BELOW_PAR",
        message: `The step limit is ${level.constraints.maxSteps}, but the shortest solution needs ${best.steps}.`,
      });
    }
    if (level.constraints.maxCommands > best.commands + Math.max(4, best.commands)) {
      warnings.push({
        gate: "par",
        path: "constraints.maxCommands",
        code: "BUDGET_FAR_ABOVE_PAR",
        message: `The command limit is ${level.constraints.maxCommands}; the shortest solution needs only ${best.commands}.`,
      });
    }
    if (referenceSolved && programSlots(program) > best.commands) {
      warnings.push({
        gate: "par",
        path: "referenceSolution",
        code: "REFERENCE_LONGER_THAN_PAR",
        message: `The reference solution uses ${programSlots(program)} commands; the shortest uses ${best.commands}.`,
      });
    }
  }

  // A level that offers REPEAT should need it: if the shortest program without loops already fits
  // the limit, a loop is optional and the level does not teach loops. A warning, not an error:
  // an introductory level may allow either.
  const offersLoop =
    level.availableCommands.includes("REPEAT") || level.availableCommands.includes("REPEAT_UNTIL");
  if (offersLoop && best) {
    const flat = solve({
      ...level,
      availableCommands: level.availableCommands.filter(
        (c) => c !== "REPEAT" && c !== "REPEAT_UNTIL",
      ),
    });
    if (flat && flat.commands <= level.constraints.maxCommands) {
      warnings.push({
        gate: "par",
        path: "constraints.maxCommands",
        code: "LOOP_NOT_REQUIRED",
        message: `The shortest program without loops needs ${flat.commands} commands and the limit is ${level.constraints.maxCommands}, so a loop is optional here.`,
      });
    }
  }

  const required = new Set<string>(level.requires.mechanics);
  for (const command of level.availableCommands) required.add(COMMAND_MECHANICS[command]);

  return { errors, warnings, par, referenceSolved, requiredMechanics: [...required].sort(), level };
}

export type MinimumClient = { version: string; supportedMechanics: string[] } | null;
export type RegistryVersion = { version: string; supportedMechanics: string[] };

/**
 * Every publish gate that currently fails, each with a code and the field it concerns. An empty
 * list means the level may be published.
 */
export function failedGates(input: {
  analysis: Analysis;
  hasSolvedPlaytest: boolean;
  chapterId: string | null;
  minimum: MinimumClient;
  registry: RegistryVersion[];
}): CheckIssue[] {
  const { analysis, hasSolvedPlaytest, chapterId, minimum, registry } = input;
  const failed: CheckIssue[] = [...analysis.errors];

  if (!hasSolvedPlaytest) {
    failed.push({
      gate: "playtest",
      path: "playtests",
      code: "PLAYTEST_REQUIRED",
      message: "Record a solved playtest for the current content before publishing.",
    });
  }

  if (!minimum) {
    failed.push({
      gate: "compatibility",
      path: "requires.mechanics",
      code: "NO_MINIMUM_CLIENT_VERSION",
      message: "No minimum supported app version is set in the client registry.",
    });
  } else {
    for (const mechanic of analysis.requiredMechanics) {
      if (minimum.supportedMechanics.includes(mechanic)) continue;
      const supporting = registry
        .filter((v) => v.supportedMechanics.includes(mechanic))
        .map((v) => v.version);
      failed.push({
        gate: "compatibility",
        path: "requires.mechanics",
        code: "UNSUPPORTED_MECHANIC",
        message:
          `The level needs the mechanic "${mechanic}", which the minimum supported app version ` +
          `${minimum.version} does not support.` +
          (supporting.length
            ? ` Supported from: ${supporting.join(", ")}; raise the minimum version to publish.`
            : " No registered app version supports it."),
      });
    }
  }

  if (!chapterId) {
    failed.push({
      gate: "placement",
      path: "chapterId",
      code: "PLACEMENT_REQUIRED",
      message: "Assign the level to a chapter before publishing.",
    });
  }
  return failed;
}
