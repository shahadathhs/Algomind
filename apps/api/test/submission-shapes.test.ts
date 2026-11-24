import { readFileSync } from "node:fs";
import { DEFAULT_POINTS_RULES } from "@algomind/level-contract";
import { describe, expect, it } from "vitest";
import { parseInput } from "../src/core/http/errors.js";
import type { AchievementsService } from "../src/modules/achievements/achievements.service.js";
import type { AuthenticatedRequest } from "../src/modules/auth/auth.types.js";
import { RateLimiter } from "../src/modules/auth/rate-limiter.js";
import type { DailyService } from "../src/modules/daily/daily.service.js";
import { PointsMeController } from "../src/modules/points/points-me.controller.js";
import { submissionBodySchema } from "../src/modules/points/points.schemas.js";
import type { PointsRulesService } from "../src/modules/points/points-rules.service.js";
import { SubmissionsService } from "../src/modules/points/submissions.service.js";
import { verifySubmission } from "../src/modules/points/verify-submission.js";
import { FakeDb } from "./support/fake-db.js";
import { failure } from "./support/http.js";
import { level as plainLevel, SOLUTION } from "./support/level.js";

type Program = Record<string, unknown>[];

/** A level with a program the reference simulator solved it with. */
type Shape = { name: string; content: Record<string, unknown>; program: Program; steps: number };

/** A run fixture of the contract suite that succeeded with a valid program. */
function run(name: string): Shape {
  const url = new URL(
    `../../../packages/level-contract/fixtures/runs/${name}.json`,
    import.meta.url,
  );
  const fixture = JSON.parse(readFileSync(url, "utf8")) as {
    level: Record<string, unknown>;
    program: Program;
    expected: { status: string; steps: number };
    programIssues: unknown[];
  };
  if (fixture.expected.status !== "SUCCEEDED" || fixture.programIssues.length > 0) {
    throw new Error(`${name} is not a solved run`);
  }
  return { name, content: fixture.level, program: fixture.program, steps: fixture.expected.steps };
}

const M = { op: "MOVE_FORWARD" };
const R = { op: "TURN_RIGHT" };

/** Every kind of node the contract allows, on a level that offers it. */
const SHAPES: Shape[] = [
  run("until-run-turn-run"),
  run("if-right-hand-rule-maze"),
  run("proc-goal-inside"),
  run("counter-spiral-reaches-the-goal"),
  {
    name: "IF at the top level",
    content: plainLevel({ availableCommands: ["MOVE_FORWARD", "TURN_RIGHT", "IF"] }),
    program: [{ op: "IF", when: "CLEAR_AHEAD", then: [M, M, M, M], else: [R] }],
    steps: 4,
  },
  {
    name: "IF inside a REPEAT body",
    content: plainLevel({ availableCommands: ["MOVE_FORWARD", "TURN_RIGHT", "REPEAT", "IF"] }),
    program: [
      { op: "REPEAT", count: 4, body: [{ op: "IF", when: "CLEAR_AHEAD", then: [M], else: [R] }] },
    ],
    steps: 4,
  },
  {
    name: 'REPEAT with count "N"',
    content: plainLevel({ availableCommands: ["MOVE_FORWARD", "REPEAT", "INC"] }),
    // The counter starts at 1: three INC make N 4, so the loop runs four times.
    program: [{ op: "INC" }, { op: "INC" }, { op: "INC" }, { op: "REPEAT", count: "N", body: [M] }],
    steps: 7,
  },
];

/** The submission route for a published version of `content`, over the fake database. */
function route(content: Record<string, unknown>) {
  const db = new FakeDb();
  db.user.rows.push({ id: "player-1" });
  db.level.rows.push({ id: "level-1", slug: content.slug, status: "PUBLISHED" });
  db.levelVersion.rows.push({
    id: "version-1",
    levelId: "level-1",
    versionNumber: 1,
    state: "PUBLISHED",
    content,
    par: { commands: 12, steps: 100 },
  });
  const submissions = new SubmissionsService(
    db.asPrisma(),
    { active: async () => DEFAULT_POINTS_RULES } as unknown as PointsRulesService,
    {} as DailyService,
    { evaluate: async () => [] } as unknown as AchievementsService,
  );
  const controller = new PointsMeController(submissions, new RateLimiter());
  const request = { user: { id: "player-1" } } as AuthenticatedRequest;
  /** What the game sends for `program`. */
  const body = (program: unknown[]) => ({ levelSlug: content.slug, levelVersion: 1, program });
  return {
    db,
    /** The route's own parse of the body, as Nest hands it over. */
    parse: (program: unknown[]) => parseInput(submissionBodySchema, body(program)),
    /** Sends the body the way Nest would hand it to the route. */
    send: (program: unknown[]) => controller.submit(body(program), request),
  };
}

describe("a program of any node shape the contract allows", () => {
  for (const { name, content, program, steps } of SHAPES) {
    it(`is accepted, verified and stored whole: ${name}`, async () => {
      const { db, parse, send } = route(content);
      expect(parse(program).program).toEqual(program); // every field kept, as sent
      expect(verifySubmission(content, program)).toMatchObject({ ok: true, steps });

      const result = await send(program);
      expect(result).toMatchObject({ duplicate: false, verified: { steps } });
      expect(db.submission.rows).toHaveLength(1);
      expect(db.submission.rows[0]!.program).toEqual(program);
    });
  }
});

describe("a malformed node", () => {
  type Fault = {
    fault: string;
    program: Program;
    /** The issue the contract reports for it. */
    issue: { path: string; code: string };
    on?: Record<string, unknown>;
  };

  const counter = SHAPES[3]!.content; // offers every command except PROC
  const procedures = SHAPES[2]!.content; // offers PROC
  const withoutCounter = plainLevel({ availableCommands: ["MOVE_FORWARD", "REPEAT"] });
  const define = [{ op: "PROC", name: "A", body: [M] }];
  const faults: Fault[] = [
    {
      fault: "a REPEAT_UNTIL without a condition",
      program: [{ op: "REPEAT_UNTIL", body: [M] }],
      issue: { path: "program[0].until", code: "REQUIRED" },
    },
    {
      fault: "a REPEAT_UNTIL with a loop's count",
      program: [{ op: "REPEAT_UNTIL", count: 3, body: [M] }],
      issue: { path: "program[0].count", code: "UNKNOWN_FIELD" },
    },
    {
      fault: "an IF without a sensor",
      program: [{ op: "IF", then: [M], else: [] }],
      issue: { path: "program[0].when", code: "REQUIRED" },
    },
    {
      fault: "an IF with a loop's body",
      program: [{ op: "IF", when: "CLEAR_AHEAD", then: [M], else: [], body: [M] }],
      issue: { path: "program[0].body", code: "UNKNOWN_FIELD" },
    },
    {
      fault: "a PROC without a name",
      program: [{ op: "PROC", body: [M] }],
      issue: { path: "program[0].name", code: "REQUIRED" },
      on: procedures,
    },
    {
      fault: "a CALL without a name",
      program: [...define, { op: "CALL" }],
      issue: { path: "program[1].name", code: "REQUIRED" },
      on: procedures,
    },
    {
      fault: "a PROC with a loop's count",
      program: [
        { op: "PROC", name: "A", body: [M], count: 2 },
        { op: "CALL", name: "A" },
      ],
      issue: { path: "program[0].count", code: "UNKNOWN_FIELD" },
      on: procedures,
    },
    {
      fault: "a REPEAT without a count",
      program: [{ op: "REPEAT", body: [M] }],
      issue: { path: "program[0].count", code: "REQUIRED" },
    },
    {
      fault: "a REPEAT whose count is text",
      program: [{ op: "REPEAT", count: "four", body: [M] }],
      issue: { path: "program[0].count", code: "INVALID_TYPE" },
    },
    {
      fault: 'a REPEAT with count "N" on a level that does not offer INC',
      program: [{ op: "REPEAT", count: "N", body: [M] }],
      issue: { path: "program[0].count", code: "COMMAND_NOT_AVAILABLE" },
      on: withoutCounter,
    },
    {
      fault: "an empty body",
      program: [{ op: "REPEAT", count: 3, body: [] }],
      issue: { path: "program[0].body", code: "LENGTH_OUT_OF_RANGE" },
    },
    {
      fault: "a plain instruction with an unknown field",
      program: [{ op: "MOVE_FORWARD", points: 999 }],
      issue: { path: "program[0].points", code: "UNKNOWN_FIELD" },
    },
  ];

  for (const { fault, program, issue, on } of faults) {
    it(`is refused with PROGRAM_INVALID: ${fault}`, async () => {
      const { db, parse, send } = route(on ?? counter);
      // The envelope lets it through: the contract is what knows a node's fields.
      expect(parse(program).program).toEqual(program);
      const refused = await failure(() => send(program));
      expect(refused).toMatchObject({ status: 422, code: "PROGRAM_INVALID" });
      const issues = (refused.issues as { path: string; code: string }[]).map(({ path, code }) => ({
        path,
        code,
      }));
      expect(issues).toContainEqual(issue);
      expect(db.submission.rows).toHaveLength(0);
    });
  }
});

describe("the envelope", () => {
  const body = (program: unknown) => ({ levelSlug: "test-level", levelVersion: 1, program });
  const refused = (input: unknown) => failure(() => parseInput(submissionBodySchema, input));

  it("takes 64 nodes, each an object with an op of 1 to 32 characters", () => {
    const nodes = Array.from({ length: 64 }, () => ({ op: "MOVE_FORWARD" }));
    expect(parseInput(submissionBodySchema, body(nodes)).program).toHaveLength(64);
    expect(() => parseInput(submissionBodySchema, body([{ op: "x".repeat(32) }]))).not.toThrow();
  });

  const invalid: { fault: string; input: unknown; path: string }[] = [
    {
      fault: "more than 64 nodes",
      input: body(Array.from({ length: 65 }, () => M)),
      path: "program",
    },
    { fault: "an empty program", input: body([]), path: "program" },
    { fault: "a node that is not an object", input: body(["MOVE_FORWARD"]), path: "program.0" },
    { fault: "a null node", input: body([null]), path: "program.0" },
    { fault: "a node without an op", input: body([{}]), path: "program.0.op" },
    { fault: "a node whose op is not text", input: body([{ op: 1 }]), path: "program.0.op" },
    {
      fault: "a node whose op is too long",
      input: body([{ op: "x".repeat(33) }]),
      path: "program.0.op",
    },
    {
      fault: "a slug with a capital",
      input: { ...body(SOLUTION), levelSlug: "First-Step" },
      path: "levelSlug",
    },
    {
      fault: "a slug with an underscore",
      input: { ...body(SOLUTION), levelSlug: "first_step" },
      path: "levelSlug",
    },
  ];

  for (const { fault, input, path } of invalid) {
    it(`refuses ${fault} with VALIDATION_FAILED`, async () => {
      expect(await refused(input)).toMatchObject({
        status: 422,
        code: "VALIDATION_FAILED",
        issues: [{ path }],
      });
    });
  }
});
