import type { Analysis } from "./level-analysis.js";
import type { CheckIssue } from "./levels.schemas.js";

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
  /** The level is in the daily pool: it is met on its day and never placed in a chapter. */
  dailyPool: boolean;
  minimum: MinimumClient;
  registry: RegistryVersion[];
}): CheckIssue[] {
  const { analysis, hasSolvedPlaytest, chapterId, dailyPool, minimum, registry } = input;
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

  // A campaign level must be in a chapter. A daily-pool level is never in one (players would
  // meet it before its day), so it publishes without.
  if (!chapterId && !dailyPool) {
    failed.push({
      gate: "placement",
      path: "chapterId",
      code: "PLACEMENT_REQUIRED",
      message: "Assign the level to a chapter before publishing.",
    });
  }
  return failed;
}
