"use client";

import { moveItem } from "@/lib/admin/list-ops";
import type { BodyNode, Instruction } from "@/lib/admin/admin-api";
import { COMMANDS, REPEAT_LIMITS, isIf } from "@/lib/admin/level-model";
import { UNTIL_LABELS, asIf, newIf, nodeLabel } from "@/lib/admin/program-model";
import { OutlineAction, SelectField } from "../ui";
import { TextAction } from "../text-action";
import { IfBranches } from "./if-branches";

/** The count and body of one loop, shown indented under its row. */
export function LoopBody({
  node,
  index,
  primitives,
  canIf,
  onCount,
  onUntil,
  onBody,
}: {
  node: Instruction;
  index: number;
  primitives: typeof COMMANDS;
  canIf: boolean;
  onCount: (count: number) => void;
  onUntil: (until: string) => void;
  onBody: (body: BodyNode[]) => void;
}) {
  const body = node.body ?? [];
  const full = body.length >= REPEAT_LIMITS.body.max;
  const id = `loop-${index}-count`;
  return (
    <div className="mt-2 mb-2 ml-8 grid gap-2 border-l-2 border-ink pl-4">
      {node.op === "REPEAT_UNTIL" ? (
        <>
          <SelectField
            label="Until"
            id={`loop-${index}-until`}
            value={node.until ?? "BLOCKED"}
            onChange={(e) => onUntil(e.target.value)}
          >
            {Object.entries(UNTIL_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </SelectField>
          <p className="text-sm font-semibold text-mute">
            {node.until === "GOAL"
              ? "The body runs round after round until the goal is reached, a move fails or the step limit stops it."
              : "The body runs while the cell ahead is open. It can run zero times."}
          </p>
        </>
      ) : (
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
      )}
      {body.length === 0 && (
        <p className="text-sm font-semibold text-mute">
          This loop is empty. Add a command to it; an empty loop is not a valid program.
        </p>
      )}
      <ol className="grid gap-1" aria-label={`Loop ${index + 1} body`}>
        {body.map((b, j) => (
          <li key={j} className="py-1">
            <div className="flex flex-wrap items-center gap-x-4">
              <span className="w-8 text-sm tracking-[2px] tabular-nums">
                {String(j + 1).padStart(2, "0")}
              </span>
              <span className="grow text-base tracking-[1px] uppercase">{nodeLabel(b)}</span>
              <TextAction
                disabled={j === 0}
                onClick={() => onBody(moveItem(body, j, j - 1))}
                aria-label={`Move command ${j + 1} of loop ${index + 1} up`}
              >
                Up
              </TextAction>
              <TextAction
                disabled={j === body.length - 1}
                onClick={() => onBody(moveItem(body, j, j + 1))}
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
            </div>
            {isIf(b) && (
              <IfBranches
                node={asIf(b)}
                where={`command ${j + 1} of loop ${index + 1}`}
                idPrefix={`loop-${index}-if-${j}`}
                primitives={primitives}
                onChange={(next) => onBody(body.map((x, k) => (k === j ? next : x)))}
              />
            )}
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
        {canIf && (
          <OutlineAction type="button" disabled={full} onClick={() => onBody([...body, newIf()])}>
            Add if
          </OutlineAction>
        )}
      </div>
      {full && (
        <p className="text-sm font-semibold text-mute">
          A loop body holds at most {REPEAT_LIMITS.body.max} commands.
        </p>
      )}
    </div>
  );
}
