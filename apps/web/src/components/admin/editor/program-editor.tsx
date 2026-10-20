"use client";

import { TapeView } from "@/components/ui/tape-view";
import { tapeFromProgram } from "@/lib/tape";
import type { Instruction } from "@/lib/admin/admin-api";
import { COMMANDS, REPEAT_LIMITS, isIf, isLoop, slotsOf } from "@/lib/admin/level-model";
import { asIf, newIf, nodeLabel, tileCommands } from "@/lib/admin/program-model";
import { OutlineAction } from "../ui";
import { moveItem } from "@/lib/admin/list-ops";
import { IfBranches } from "./if-branches";
import { LoopBody } from "./loop-body";
import { TextAction } from "../text-action";

export function ProgramEditor({
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
  const primitives = COMMANDS.filter((c) => !isLoop(c) && !isIf(c) && available.includes(c.op));
  const canRepeat = available.includes("REPEAT");
  const canRepeatUntil = available.includes("REPEAT_UNTIL");
  const canIf = available.includes("IF");

  const setLoop = (i: number, change: Partial<Instruction>) =>
    onChange(program.map((node, j) => (j === i ? { ...node, ...change } : node)));

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
        {canRepeatUntil && (
          <OutlineAction
            type="button"
            onClick={() =>
              onChange([...program, { op: "REPEAT_UNTIL", until: "BLOCKED", body: [] }])
            }
          >
            Add repeat until
          </OutlineAction>
        )}
        {canIf && (
          <OutlineAction type="button" onClick={() => onChange([...program, newIf()])}>
            Add if
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
                <span className="grow text-base tracking-[1px] uppercase">{nodeLabel(p)}</span>
                <TextAction
                  disabled={i === 0}
                  onClick={() => onChange(moveItem(program, i, i - 1))}
                  aria-label={`Move step ${i + 1} up`}
                >
                  Up
                </TextAction>
                <TextAction
                  disabled={i === program.length - 1}
                  onClick={() => onChange(moveItem(program, i, i + 1))}
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
              {isLoop(p) && (
                <LoopBody
                  node={p}
                  index={i}
                  primitives={primitives}
                  canIf={canIf}
                  onCount={(count) => setLoop(i, { count })}
                  onUntil={(until) => setLoop(i, { until })}
                  onBody={(body) => setLoop(i, { body })}
                />
              )}
              {isIf(p) && (
                <IfBranches
                  node={asIf(p)}
                  where={`step ${i + 1}`}
                  idPrefix={`${idPrefix}-if-${i}`}
                  primitives={primitives}
                  onChange={(next) => onChange(program.map((node, j) => (j === i ? next : node)))}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
