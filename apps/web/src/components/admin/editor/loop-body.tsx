"use client";

import { moveItem } from "@/lib/admin/list-ops";
import type { BodyNode, Instruction } from "@/lib/admin/admin-api";
import { REPEAT_LIMITS, isCall, isIf, primitivesOf } from "@/lib/admin/level-model";
import { UNTIL_LABELS, asIf, nodeLabel } from "@/lib/admin/program-model";
import { SelectField } from "../ui";
import { AddCommands } from "./add-commands";
import { CallName } from "./call-name";
import { IfBranches } from "./if-branches";
import { ItemRow } from "./item-row";

/** The count and body of one loop, shown indented under its row. */
export function LoopBody({
  node,
  name,
  idPrefix,
  available,
  callNames,
  onCount,
  onUntil,
  onBody,
}: {
  node: Instruction;
  /** E.g. "loop 1" or "command 2 of procedure A"; names the loop for assistive technology. */
  name: string;
  idPrefix: string;
  available: string[];
  /** The defined procedure names when a CALL may stand in this body (the main program); else omitted. */
  callNames?: readonly string[];
  onCount: (count: number) => void;
  onUntil: (until: string) => void;
  onBody: (body: BodyNode[]) => void;
}) {
  const body = node.body ?? [];
  const full = body.length >= REPEAT_LIMITS.body.max;
  const id = `${idPrefix}-count`;
  return (
    <div className="mt-2 mb-2 ml-8 grid gap-2 border-l-2 border-ink pl-4">
      {node.op === "REPEAT_UNTIL" ? (
        <>
          <SelectField
            label="Until"
            id={`${idPrefix}-until`}
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
      <ol className="grid gap-1" aria-label={`${name[0]!.toUpperCase()}${name.slice(1)} body`}>
        {body.map((b, j) => (
          <li key={j} className="py-1">
            <ItemRow
              index={j}
              count={body.length}
              text={nodeLabel(b)}
              name={`command ${j + 1} of ${name}`}
              onMove={(to) => onBody(moveItem(body, j, to))}
              onRemove={() => onBody(body.filter((_, k) => k !== j))}
            />
            {isIf(b) && (
              <IfBranches
                node={asIf(b)}
                where={`command ${j + 1} of ${name}`}
                idPrefix={`${idPrefix}-if-${j}`}
                primitives={primitivesOf(available)}
                onChange={(next) => onBody(body.map((x, k) => (k === j ? next : x)))}
              />
            )}
            {isCall(b) && callNames && (
              <CallName
                value={(b as Instruction).name ?? ""}
                names={callNames}
                id={`${idPrefix}-call-${j}`}
                where={`command ${j + 1} of ${name}`}
                onChange={(next) =>
                  onBody(body.map((x, k) => (k === j ? { ...x, name: next } : x)))
                }
              />
            )}
          </li>
        ))}
      </ol>
      <AddCommands
        available={available}
        label={`Add a command to ${name}`}
        disabled={full}
        callNames={callNames}
        onAdd={(node) => onBody([...body, node])}
      />
      {full && (
        <p className="text-sm font-semibold text-mute">
          A loop body holds at most {REPEAT_LIMITS.body.max} commands.
        </p>
      )}
    </div>
  );
}
