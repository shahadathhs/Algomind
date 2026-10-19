"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BoardView } from "@/components/ui/board-view";
import { TapeView } from "@/components/ui/tape-view";
import { Caption } from "@/components/ui/caption";
import { tapeFromProgram } from "@/lib/tape";
import { ApiError, SessionEndedError } from "@/lib/api/errors";
import type {
  CheckIssue,
  Difficulty,
  Instruction,
  LevelContent,
  Playtest,
  ValidateResult,
} from "@/lib/admin/admin-api";
import {
  applyTool,
  BOARD_MAX,
  BOARD_MIN,
  boardData,
  COMMANDS,
  DIRECTIONS,
  localCheck,
  MAX_COMMANDS,
  MAX_STEPS,
  REPEAT_LIMITS,
  resizeBoard,
  simulate,
  slotsOf,
  tileCommands,
  type Direction,
  type Tool,
} from "@/lib/admin/level-model";
import { explainResult, type Level, type Program } from "@algomind/level-contract";
import { Field, Notice, OutlineAction, SelectField } from "./ui";
import { useAdminApi } from "./use-admin-api";

type ContentProps = { content: LevelContent; onChange: (next: LevelContent) => void };

/** A small text-style action. */
function TextAction({
  children,
  ...button
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px] disabled:text-mute disabled:no-underline"
      {...button}
    >
      {children}
    </button>
  );
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : "The server could not be reached.";
}

/* ───────────────────────── Details ───────────────────────── */

export function DetailsPanel({ content, onChange, slug }: ContentProps & { slug: string }) {
  const hints = content.hints;
  return (
    <div className="grid max-w-[640px] gap-6">
      <Field
        label="Title"
        id="ed-title"
        value={content.title}
        maxLength={60}
        onChange={(e) => onChange({ ...content, title: e.target.value })}
      />
      <Field
        label="Slug"
        id="ed-slug"
        value={slug}
        readOnly
        hint="Fixed once the level is published."
      />
      <div>
        <label
          htmlFor="ed-description"
          className="mb-2 block text-xs tracking-[2px] text-mute uppercase"
        >
          Description
        </label>
        <span className="tile block bg-ink p-[2px]" style={{ ["--chamfer" as string]: "12px" }}>
          <textarea
            id="ed-description"
            rows={3}
            maxLength={280}
            value={content.description}
            onChange={(e) => onChange({ ...content, description: e.target.value })}
            className="block w-full bg-floor px-4 py-3 text-base text-ink focus-visible:outline-offset-[-7px]"
          />
        </span>
      </div>
      <SelectField
        label="Difficulty"
        id="ed-difficulty"
        value={content.difficulty}
        onChange={(e) => onChange({ ...content, difficulty: e.target.value as Difficulty })}
      >
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </SelectField>
      <fieldset>
        <legend className="mb-2 text-xs tracking-[2px] text-mute uppercase">
          Hints ({hints.length} of 5)
        </legend>
        <ul className="grid gap-3">
          {hints.map((hint, i) => (
            <li key={i} className="flex items-end gap-3">
              <div className="grow">
                <Field
                  label={`Hint ${i + 1}`}
                  id={`ed-hint-${i}`}
                  value={hint}
                  maxLength={140}
                  onChange={(e) =>
                    onChange({
                      ...content,
                      hints: hints.map((h, j) => (j === i ? e.target.value : h)),
                    })
                  }
                />
              </div>
              <TextAction
                onClick={() => onChange({ ...content, hints: hints.filter((_, j) => j !== i) })}
              >
                Remove
              </TextAction>
            </li>
          ))}
        </ul>
        {hints.length < 5 && (
          <div className="mt-3">
            <OutlineAction
              type="button"
              onClick={() => onChange({ ...content, hints: [...hints, ""] })}
            >
              Add hint
            </OutlineAction>
          </div>
        )}
      </fieldset>
    </div>
  );
}

/* ───────────────────────── Board ───────────────────────── */

const TOOLS: { id: Tool; label: string }[] = [
  { id: "wall", label: "Wall" },
  { id: "floor", label: "Floor" },
  { id: "start", label: "Start" },
  { id: "goal", label: "Goal" },
];

export function BoardPanel({ content, onChange }: ContentProps) {
  const [tool, setTool] = useState<Tool>("wall");
  const { width, height } = content.board;
  const [sx, sy] = content.initialState.position;
  const [gx, gy] = content.goal.position;
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isWall = content.board.walls.some(([wx, wy]) => wx === x && wy === y);
      const isStart = x === sx && y === sy;
      const isGoal = x === gx && y === gy;
      const label = `Cell ${x + 1}, ${y + 1}: ${isStart ? "start" : isGoal ? "goal" : isWall ? "wall" : "floor"}`;
      cells.push(
        <button
          key={`${x}-${y}`}
          type="button"
          aria-label={label}
          onClick={() => onChange(applyTool(content, tool, x, y))}
          className={`flex aspect-square items-center justify-center text-[15px] font-bold outline-offset-[-4px] ${
            isWall
              ? "bg-wall text-on-ink"
              : isGoal
                ? "bg-signal text-on-signal"
                : "bg-floor text-ink"
          } ${isStart ? "outline-[3px] -outline-offset-[5px] outline-ink" : ""}`}
        >
          {isStart ? "S" : isGoal ? "G" : isWall ? "W" : ""}
        </button>,
      );
    }
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div role="radiogroup" aria-label="Board tool" className="mb-4 flex flex-wrap gap-3">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tool === t.id}
              onClick={() => setTool(t.id)}
              className={`tile inline-flex h-11 items-center px-5 text-[13px] tracking-[2px] uppercase ${
                tool === t.id ? "bg-ink text-on-ink" : "bg-strip text-ink"
              }`}
              style={{ ["--chamfer" as string]: "10px" }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Board cells"
          className="grid max-w-[560px] gap-[2px] bg-faint p-[2px]"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
        >
          {cells}
        </div>
        <p className="mt-3 text-sm font-semibold text-mute">
          Pick a tool, then select cells. S marks the start, G the goal, W a wall.
        </p>
      </div>
      <div className="grid content-start gap-5">
        <Field
          label={`Width (${BOARD_MIN} to ${BOARD_MAX})`}
          id="ed-width"
          type="number"
          min={BOARD_MIN}
          max={BOARD_MAX}
          value={width}
          onChange={(e) =>
            onChange(resizeBoard(content, Number(e.target.value) || BOARD_MIN, height))
          }
        />
        <Field
          label={`Height (${BOARD_MIN} to ${BOARD_MAX})`}
          id="ed-height"
          type="number"
          min={BOARD_MIN}
          max={BOARD_MAX}
          value={height}
          onChange={(e) =>
            onChange(resizeBoard(content, width, Number(e.target.value) || BOARD_MIN))
          }
        />
        <SelectField
          label="Start facing"
          id="ed-facing"
          value={content.initialState.direction}
          onChange={(e) =>
            onChange({
              ...content,
              initialState: { ...content.initialState, direction: e.target.value as Direction },
            })
          }
        >
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d[0]!.toUpperCase() + d.slice(1)}
            </option>
          ))}
        </SelectField>
        <div>
          <Caption className="mb-2">Board</Caption>
          <BoardView board={boardData(content)} label="Preview of the board as players see it." />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Commands and limits ───────────────────────── */

function mechanicsFor(commands: string[]): string[] {
  const out: string[] = [];
  if (commands.includes("MOVE_FORWARD")) out.push("move");
  if (commands.includes("TURN_LEFT") || commands.includes("TURN_RIGHT")) out.push("turn");
  if (commands.includes("REPEAT")) out.push("repeat");
  return out;
}

export function LimitsPanel({ content, onChange }: ContentProps) {
  const toggle = (op: string) => {
    const has = content.availableCommands.includes(op);
    const next = COMMANDS.map((c) => c.op as string).filter((o) =>
      o === op ? !has : content.availableCommands.includes(o),
    );
    onChange({ ...content, availableCommands: next, requires: { mechanics: mechanicsFor(next) } });
  };
  return (
    <div className="grid max-w-[560px] gap-6">
      <fieldset>
        <legend className="mb-3 text-xs tracking-[2px] text-mute uppercase">
          Allowed commands
        </legend>
        <div className="grid gap-2">
          {COMMANDS.map((c) => (
            <label key={c.op} className="flex min-h-11 items-center gap-3 text-base font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--ink)]"
                checked={content.availableCommands.includes(c.op)}
                onChange={() => toggle(c.op)}
              />
              {c.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm font-semibold text-mute">
          Required mechanics follow the commands: {content.requires.mechanics.join(", ") || "none"}.
        </p>
      </fieldset>
      <Field
        label={`Max commands (${MAX_COMMANDS.min} to ${MAX_COMMANDS.max})`}
        id="ed-max-commands"
        type="number"
        min={MAX_COMMANDS.min}
        max={MAX_COMMANDS.max}
        value={content.constraints.maxCommands}
        onChange={(e) =>
          onChange({
            ...content,
            constraints: { ...content.constraints, maxCommands: Number(e.target.value) || 1 },
          })
        }
        hint="How many instructions a player may place."
      />
      <Field
        label={`Max steps (${MAX_STEPS.min} to ${MAX_STEPS.max})`}
        id="ed-max-steps"
        type="number"
        min={MAX_STEPS.min}
        max={MAX_STEPS.max}
        value={content.constraints.maxSteps}
        onChange={(e) =>
          onChange({
            ...content,
            constraints: { ...content.constraints, maxSteps: Number(e.target.value) || 1 },
          })
        }
        hint="A run is stopped after this many steps."
      />
    </div>
  );
}

/* ───────────────────────── Tape editing (Solution and Preview) ───────────────────────── */

function ProgramEditor({
  program,
  onChange,
  available,
  idPrefix,
}: {
  program: Instruction[];
  onChange: (next: Instruction[]) => void;
  available: string[];
  idPrefix: string;
}) {
  const slots = slotsOf(program);
  const tiles = tapeFromProgram(tileCommands(program), { emptySlot: "plus" });
  const primitives = COMMANDS.filter((c) => c.op !== "REPEAT" && available.includes(c.op));
  const canRepeat = available.includes("REPEAT");

  const move = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    return next;
  };
  const setLoop = (i: number, change: Partial<Instruction>) =>
    onChange(program.map((node, j) => (j === i ? { ...node, ...change } : node)));
  const label = (op: string) => COMMANDS.find((c) => c.op === op)?.label ?? op;

  return (
    <div>
      <div className="mb-4 max-w-[560px]">
        <TapeView
          tiles={tiles}
          label={
            program.length ? `Program of ${slots} commands.` : "An empty program. Add a command."
          }
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-3" role="group" aria-label="Add a command">
        {primitives.map((c) => (
          <OutlineAction
            key={c.op}
            type="button"
            onClick={() => onChange([...program, { op: c.op }])}
          >
            Add {c.label.toLowerCase()}
          </OutlineAction>
        ))}
        {canRepeat && (
          <OutlineAction
            type="button"
            onClick={() =>
              onChange([...program, { op: "REPEAT", count: REPEAT_LIMITS.count.min, body: [] }])
            }
          >
            Add repeat
          </OutlineAction>
        )}
      </div>
      {program.length > 0 && (
        <ol className="grid max-w-[560px] gap-1" aria-label={`${idPrefix} program`}>
          {program.map((p, i) => (
            <li key={i} className="border-t-2 border-ink py-1">
              <div className="flex flex-wrap items-center gap-x-4">
                <span className="w-8 text-sm tracking-[2px] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="grow text-base tracking-[1px] uppercase">{label(p.op)}</span>
                <TextAction
                  disabled={i === 0}
                  onClick={() => onChange(move(program, i, i - 1))}
                  aria-label={`Move step ${i + 1} up`}
                >
                  Up
                </TextAction>
                <TextAction
                  disabled={i === program.length - 1}
                  onClick={() => onChange(move(program, i, i + 1))}
                  aria-label={`Move step ${i + 1} down`}
                >
                  Down
                </TextAction>
                <TextAction
                  onClick={() => onChange(program.filter((_, j) => j !== i))}
                  aria-label={`Remove step ${i + 1}`}
                >
                  Remove
                </TextAction>
              </div>
              {p.op === "REPEAT" && (
                <LoopBody
                  node={p}
                  index={i}
                  primitives={primitives}
                  label={label}
                  onCount={(count) => setLoop(i, { count })}
                  onBody={(body) => setLoop(i, { body })}
                  move={move}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The count and body of one loop, shown indented under its row. */
function LoopBody({
  node,
  index,
  primitives,
  label,
  onCount,
  onBody,
  move,
}: {
  node: Instruction;
  index: number;
  primitives: typeof COMMANDS;
  label: (op: string) => string;
  onCount: (count: number) => void;
  onBody: (body: { op: string }[]) => void;
  move: <T>(list: T[], from: number, to: number) => T[];
}) {
  const body = node.body ?? [];
  const full = body.length >= REPEAT_LIMITS.body.max;
  const id = `loop-${index}-count`;
  return (
    <div className="mt-2 mb-2 ml-8 grid gap-2 border-l-2 border-ink pl-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="text-xs tracking-[2px] text-mute uppercase">
          Rounds ({REPEAT_LIMITS.count.min} to {REPEAT_LIMITS.count.max})
        </label>
        <input
          id={id}
          type="number"
          min={REPEAT_LIMITS.count.min}
          max={REPEAT_LIMITS.count.max}
          value={node.count ?? REPEAT_LIMITS.count.min}
          onChange={(e) =>
            onCount(
              Math.min(
                REPEAT_LIMITS.count.max,
                Math.max(REPEAT_LIMITS.count.min, Math.round(Number(e.target.value)) || 2),
              ),
            )
          }
          className="h-11 w-20 border-2 border-ink bg-floor px-3 text-base text-ink"
        />
      </div>
      {body.length === 0 && (
        <p className="text-sm font-semibold text-mute">
          This loop is empty. Add a command to it; an empty loop is not a valid program.
        </p>
      )}
      <ol className="grid gap-1" aria-label={`Loop ${index + 1} body`}>
        {body.map((b, j) => (
          <li key={j} className="flex flex-wrap items-center gap-x-4 py-1">
            <span className="w-8 text-sm tracking-[2px] tabular-nums">
              {String(j + 1).padStart(2, "0")}
            </span>
            <span className="grow text-base tracking-[1px] uppercase">{label(b.op)}</span>
            <TextAction
              disabled={j === 0}
              onClick={() => onBody(move(body, j, j - 1))}
              aria-label={`Move command ${j + 1} of loop ${index + 1} up`}
            >
              Up
            </TextAction>
            <TextAction
              disabled={j === body.length - 1}
              onClick={() => onBody(move(body, j, j + 1))}
              aria-label={`Move command ${j + 1} of loop ${index + 1} down`}
            >
              Down
            </TextAction>
            <TextAction
              onClick={() => onBody(body.filter((_, k) => k !== j))}
              aria-label={`Remove command ${j + 1} of loop ${index + 1}`}
            >
              Remove
            </TextAction>
          </li>
        ))}
      </ol>
      <div
        className="flex flex-wrap gap-3"
        role="group"
        aria-label={`Add a command to loop ${index + 1}`}
      >
        {primitives.map((c) => (
          <OutlineAction
            key={c.op}
            type="button"
            disabled={full}
            onClick={() => onBody([...body, { op: c.op }])}
          >
            Add {c.label.toLowerCase()}
          </OutlineAction>
        ))}
      </div>
      {full && (
        <p className="text-sm font-semibold text-mute">
          A loop body holds at most {REPEAT_LIMITS.body.max} commands.
        </p>
      )}
    </div>
  );
}

export function SolutionPanel({
  content,
  solution,
  onSolution,
}: {
  content: LevelContent;
  solution: Instruction[];
  onSolution: (next: Instruction[]) => void;
}) {
  const check = useMemo(() => localCheck(content, solution), [content, solution]);
  const par = check.par;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <ProgramEditor
          program={solution}
          onChange={onSolution}
          available={content.availableCommands}
          idPrefix="Reference"
        />
      </div>
      <div className="grid content-start gap-4">
        <Caption>Reference solution</Caption>
        <p className="text-base font-semibold">
          {slotsOf(solution)} {slotsOf(solution) === 1 ? "command" : "commands"}
          {par && `, par ${par.commands}`}
        </p>
        {!check.validation.ok ? (
          <Notice kind="info">
            The level is not valid yet, so the solution cannot be run. See the Checks tab.
          </Notice>
        ) : check.solved ? (
          <Notice kind="info">This solution reaches the goal.</Notice>
        ) : (
          <Notice>This solution does not reach the goal.</Notice>
        )}
        {par && slotsOf(solution) > par.commands && check.solved && (
          <Notice kind="info">A shorter solution exists: {par.commands} commands.</Notice>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Preview ───────────────────────── */

export function PreviewPanel({
  content,
  solution,
}: {
  content: LevelContent;
  solution: Instruction[];
}) {
  const [program, setProgram] = useState<Instruction[]>(solution);
  const [step, setStep] = useState(0);
  const result = useMemo(() => {
    try {
      return simulate(content as unknown as Level, program as unknown as Program);
    } catch {
      return null;
    }
  }, [content, program]);

  const total = result?.trace.length ?? 0;
  const shown = Math.min(step, total);
  const entry = shown > 0 ? result?.trace[shown - 1] : undefined;
  const trace = result?.trace.slice(0, shown) ?? [];
  const [sx, sy] = content.initialState.position;
  const position = entry ? entry.position : ([sx, sy] as [number, number]);
  const direction = entry ? entry.direction : content.initialState.direction;
  const finished = result !== null && shown >= total;
  const blocked = finished && result?.blockedCell ? result.blockedCell : undefined;

  const board = boardData(content, {
    automaton: { x: position[0], y: position[1], dir: direction },
    trail: trace.map((t) => t.position),
    hit: blocked && blocked[0] >= 0 && blocked[1] >= 0 ? blocked : undefined,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <Caption className="mb-3">Program to try</Caption>
        <ProgramEditor
          program={program}
          onChange={(next) => {
            setProgram(next);
            setStep(0);
          }}
          available={content.availableCommands}
          idPrefix="Preview"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <OutlineAction
            type="button"
            onClick={() => setStep((s) => Math.min(total, s + 1))}
            disabled={!result || shown >= total}
          >
            Step
          </OutlineAction>
          <OutlineAction
            type="button"
            onClick={() => setStep(total)}
            disabled={!result || shown >= total}
          >
            Run
          </OutlineAction>
          <OutlineAction type="button" onClick={() => setStep(0)} disabled={shown === 0}>
            Reset
          </OutlineAction>
          <OutlineAction
            type="button"
            onClick={() => {
              setProgram(solution);
              setStep(0);
            }}
          >
            Use reference solution
          </OutlineAction>
        </div>
      </div>
      <div>
        <BoardView board={board} label={`Board after ${shown} of ${total} steps.`} />
        <p role="status" className="mt-3 text-base font-semibold">
          {result === null
            ? "This level cannot be simulated yet. Check the Checks tab."
            : finished
              ? `${explainResult(result)} ${total} ${total === 1 ? "step" : "steps"}.`
              : `Step ${shown} of ${total}.`}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── Playtest ───────────────────────── */

export function PlaytestPanel({
  levelId,
  hasDraft,
  commandsHint,
  onRecorded,
}: {
  levelId: string;
  hasDraft: boolean;
  commandsHint: number;
  onRecorded: () => void;
}) {
  const api = useAdminApi();
  const [records, setRecords] = useState<Playtest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tester, setTester] = useState("");
  const [solved, setSolved] = useState(true);
  const [commands, setCommands] = useState(String(commandsHint));
  const [difficulty, setDifficulty] = useState<"" | Difficulty>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let live = true;
    api.listPlaytests(levelId).then(
      (r) => live && setRecords(r.items),
      (err: unknown) => {
        if (live && !(err instanceof SessionEndedError)) setError(errorText(err));
      },
    );
    return () => {
      live = false;
    };
  }, [api, levelId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tester.trim()) return setError("Enter the tester's name.");
    setBusy(true);
    try {
      await api.addPlaytest(levelId, {
        testerName: tester.trim(),
        solved,
        commandsUsed: commands === "" ? undefined : Number(commands),
        perceivedDifficulty: difficulty || undefined,
        notes,
      });
      setNotes("");
      const r = await api.listPlaytests(levelId);
      setRecords(r.items);
      onRecorded();
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <form onSubmit={submit} aria-label="Record a playtest" className="grid content-start gap-5">
        <Caption as="h2">Record a playtest</Caption>
        {!hasDraft && <Notice kind="info">Start a draft to record a playtest.</Notice>}
        <Field
          label="Tester"
          id="pt-tester"
          value={tester}
          maxLength={80}
          onChange={(e) => setTester(e.target.value)}
        />
        <SelectField
          label="Result"
          id="pt-solved"
          value={solved ? "yes" : "no"}
          onChange={(e) => setSolved(e.target.value === "yes")}
        >
          <option value="yes">Solved</option>
          <option value="no">Not solved</option>
        </SelectField>
        <Field
          label="Commands used"
          id="pt-commands"
          type="number"
          min={0}
          max={1000}
          value={commands}
          onChange={(e) => setCommands(e.target.value)}
        />
        <SelectField
          label="Perceived difficulty"
          id="pt-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as "" | Difficulty)}
        >
          <option value="">Not given</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </SelectField>
        <Field
          label="Notes"
          id="pt-notes"
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <Notice>{error}</Notice>}
        <div>
          <OutlineAction type="submit" disabled={busy || !hasDraft}>
            {busy ? "Recording" : "Record playtest"}
          </OutlineAction>
        </div>
      </form>
      <div>
        <Caption as="h2" className="mb-3">
          Records
        </Caption>
        {records === null && !error && (
          <p role="status" className="text-sm tracking-[2px] uppercase">
            Loading
          </p>
        )}
        {records?.length === 0 && (
          <p className="text-base font-semibold text-mute">No playtests recorded.</p>
        )}
        <ul className="grid gap-3">
          {records?.map((r) => (
            <li key={r.id} className="border-t-2 border-ink pt-3">
              <p className="text-base tracking-[1px] uppercase">
                {r.testerName} · {r.solved ? "Solved" : "Not solved"}
              </p>
              <p className="mt-1 text-sm font-semibold text-mute">
                {r.current ? "Current content" : "Stale: the level changed since"} · v
                {r.versionNumber}
                {r.commandsUsed !== null && ` · ${r.commandsUsed} commands`}
                {r.perceivedDifficulty && ` · ${r.perceivedDifficulty}`}
              </p>
              {r.notes && <p className="mt-1 text-[15px] font-semibold">{r.notes}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────── Checks and publish ───────────────────────── */

function IssueList({ title, issues }: { title: string; issues: CheckIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div>
      <Caption as="h3" className="mb-2">
        {title} ({issues.length})
      </Caption>
      <ul className="grid gap-2">
        {issues.map((issue, i) => (
          <li
            key={i}
            className="flex flex-wrap gap-x-3 border-t border-faint pt-2 text-[15px] font-semibold"
          >
            <span className="text-xs tracking-[2px] uppercase">{issue.gate.replace("_", " ")}</span>
            <span className="text-mute">{issue.path || "level"}</span>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChecksPanel({
  levelId,
  dirty,
  hasDraft,
}: {
  levelId: string;
  dirty: boolean;
  hasDraft: boolean;
}) {
  const api = useAdminApi();
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "validate">("");

  async function validate() {
    setError(null);
    setBusy("validate");
    try {
      setResult(await api.validateLevel(levelId));
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid max-w-[760px] gap-6">
      {!hasDraft && <Notice kind="info">Start a draft to validate or publish.</Notice>}
      {dirty && hasDraft && (
        <Notice kind="info">Save the draft first. Checks run on the saved draft.</Notice>
      )}
      <div className="flex flex-wrap gap-3">
        <OutlineAction
          type="button"
          onClick={() => void validate()}
          disabled={!hasDraft || dirty || busy !== ""}
        >
          {busy === "validate" ? "Checking" : "Run checks"}
        </OutlineAction>
        {hasDraft && !dirty && (
          <Link
            href={`/admin/publish/${levelId}`}
            className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px]"
          >
            Review and publish
          </Link>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
      {result && (
        <div className="grid gap-6">
          <div>
            <Caption as="h3" className="mb-2">
              Summary
            </Caption>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[15px] font-semibold">
              <dt className="text-mute">Valid</dt>
              <dd>{result.ok ? "Yes" : "No"}</dd>
              <dt className="text-mute">Reference solved</dt>
              <dd>{result.referenceSolved ? "Yes" : "No"}</dd>
              <dt className="text-mute">Par</dt>
              <dd>
                {result.par
                  ? `${result.par.commands} commands, ${result.par.steps} steps`
                  : "Not available"}
              </dd>
              <dt className="text-mute">Mechanics</dt>
              <dd>{result.requiredMechanics.join(", ") || "None"}</dd>
              <dt className="text-mute">Playtest for this content</dt>
              <dd>{result.playtests.solvedForCurrentContent ? "Solved" : "Missing"}</dd>
              <dt className="text-mute">Minimum client</dt>
              <dd>{result.compatibility.minimumVersion ?? "None set"}</dd>
              <dt className="text-mute">Ready to publish</dt>
              <dd>{result.publish.ready ? "Yes" : "No"}</dd>
            </dl>
          </div>
          <IssueList title="Errors" issues={result.errors} />
          <IssueList title="Warnings" issues={result.warnings} />
          <IssueList title="Publishing would be blocked by" issues={result.publish.failedGates} />
        </div>
      )}
    </div>
  );
}
