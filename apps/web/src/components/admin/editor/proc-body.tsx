"use client";

import { moveItem } from "@/lib/admin/list-ops";
import type { Instruction } from "@/lib/admin/admin-api";
import { PROC_LIMITS, isIf, isLoop, primitivesOf } from "@/lib/admin/level-model";
import { asIf, nodeLabel } from "@/lib/admin/program-model";
import { AddCommands } from "./add-commands";
import { IfBranches } from "./if-branches";
import { ItemRow } from "./item-row";
import { LoopBody } from "./loop-body";

/** The body of one PROC: primitives, ifs and loops (never a call), shown indented under its row. */
export function ProcBody({
  node,
  available,
  idPrefix,
  onBody,
}: {
  node: Instruction;
  available: string[];
  idPrefix: string;
  onBody: (body: Instruction[]) => void;
}) {
  const body = node.body ?? [];
  const full = body.length >= PROC_LIMITS.body.max;
  const name = `procedure ${node.name ?? ""}`;
  const setItem = (j: number, change: Partial<Instruction>) =>
    onBody(body.map((x, k) => (k === j ? { ...x, ...change } : x)));
  return (
    <div className="mt-2 mb-2 ml-8 grid gap-2 border-l-2 border-ink pl-4">
      {body.length === 0 && (
        <p className="text-sm font-semibold text-mute">
          This procedure is empty. Add a command to it; an empty procedure is not a valid program.
        </p>
      )}
      <ol className="grid gap-1" aria-label={`Body of ${name}`}>
        {body.map((b, j) => {
          const where = `command ${j + 1} of ${name}`;
          return (
            <li key={j} className="py-1">
              <ItemRow
                index={j}
                count={body.length}
                text={nodeLabel(b)}
                name={where}
                onMove={(to) => onBody(moveItem(body, j, to))}
                onRemove={() => onBody(body.filter((_, k) => k !== j))}
              />
              {isLoop(b) && (
                <LoopBody
                  node={b}
                  name={`loop ${j + 1} of ${name}`}
                  idPrefix={`${idPrefix}-loop-${j}`}
                  available={available}
                  onCount={(count) => setItem(j, { count })}
                  onUntil={(until) => setItem(j, { until })}
                  onBody={(inner) => setItem(j, { body: inner })}
                />
              )}
              {isIf(b) && (
                <IfBranches
                  node={asIf(b)}
                  where={where}
                  idPrefix={`${idPrefix}-if-${j}`}
                  primitives={primitivesOf(available)}
                  onChange={(next) => onBody(body.map((x, k) => (k === j ? next : x)))}
                />
              )}
            </li>
          );
        })}
      </ol>
      <AddCommands
        available={available}
        label={`Add a command to ${name}`}
        disabled={full}
        loops
        onAdd={(item) => onBody([...body, item])}
      />
      {full && (
        <p className="text-sm font-semibold text-mute">
          A procedure body holds at most {PROC_LIMITS.body.max} commands.
        </p>
      )}
    </div>
  );
}
