"use client";

import { moveItem } from "@/lib/admin/list-ops";
import type { Instruction } from "@/lib/admin/admin-api";
import { COMMANDS, REPEAT_LIMITS } from "@/lib/admin/level-model";
import { OutlineAction } from "../ui";
import { TextAction } from "../text-action";

/** The count and body of one loop, shown indented under its row. */
export function LoopBody({
  node,
  index,
  primitives,
  label,
  onCount,
  onBody,
}: {
  node: Instruction;
  index: number;
  primitives: typeof COMMANDS;
  label: (op: string) => string;
  onCount: (count: number) => void;
  onBody: (body: { op: string }[]) => void;
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
