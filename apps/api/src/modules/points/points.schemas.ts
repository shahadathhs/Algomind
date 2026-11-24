import { z } from "zod";

const points = z.number().int().min(0).max(1000);

/** A rule set as the dashboard edits it. The version is assigned by the server. */
export const pointsRulesInputSchema = z
  .object({
    base: z.object({ easy: points, medium: points, hard: points }).strict(),
    parFull: points,
    parNear: points,
    nearSlots: z.number().int().min(0).max(10),
    stepsBonus: points,
    firstClear: points,
  })
  .strict();
export type PointsRulesInput = z.infer<typeof pointsRulesInputSchema>;

export const pointsRulesSchema = pointsRulesInputSchema.extend({
  version: z.number().int().min(1),
});

export const ruleSetViewSchema = z.object({
  version: z.number().int(),
  rules: pointsRulesSchema,
  active: z.boolean(),
  createdAt: z.string(),
});
export type RuleSetView = z.infer<typeof ruleSetViewSchema>;

/**
 * One node of a submitted program. Only `op` is described here: the contract's `validateProgram`
 * (see verify-submission.ts) is the one description of a valid node, so a loop's `until` or
 * `count`, an IF's branches and a procedure's `name` pass through as sent, and a malformed node
 * is refused there with 422 PROGRAM_INVALID. The object is loose on purpose: a plain object
 * schema would strip those keys before the program is verified and stored.
 */
const node = z.looseObject({ op: z.string().min(1).max(32) });

/** What the game submits: the level version it played and the program. Never a score. */
export const submissionBodySchema = z.object({
  levelSlug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  levelVersion: z.number().int().min(1).max(1_000_000),
  /**
   * At most 64 nodes, inside a body of at most 64 kB (app.setup.ts): whatever the nodes hold,
   * that cap bounds the work of validating, hashing and storing the program.
   */
  program: z.array(node).min(1).max(64),
  /** Claims the result for a daily challenge: the UTC date of the day it was played. */
  dailyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type SubmissionBody = z.infer<typeof submissionBodySchema>;

export type SubmissionResult = {
  /** True when this exact program was already submitted for this level version. */
  duplicate: boolean;
  verified: { slots: number; steps: number };
  stars: 1 | 2 | 3;
  /** What the result is worth, first-clear bonus included. */
  points: number;
  /** What this submission added to the player's total (0 when it did not beat an earlier result). */
  awarded: number;
  total: number;
  ruleVersion: number;
  /** Set when the submission claimed a daily challenge: whether it counted, and the streak. */
  daily?: { accepted: boolean; streak: { current: number; best: number } };
  /** Badges this submission earned just now. */
  achievements?: { slug: string; title: string }[];
};

export type PointsView = {
  total: number;
  levels: { levelSlug: string; stars: number; points: number }[];
};
