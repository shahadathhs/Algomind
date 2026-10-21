"use client";

import { TapeView } from "@/components/ui/tape-view";
import { tapeFromProgram } from "@/lib/tape";
import type { Instruction } from "@/lib/admin/admin-api";
import { isCall, isIf, isLoop, isProc, primitivesOf, slotsOf } from "@/lib/admin/level-model";
import {
  asIf,
  definedNames,
  nextFreeName,
  nodeLabel,
  tileCommands,
} from "@/lib/admin/program-model";
import { moveItem } from "@/lib/admin/list-ops";
import { AddCommands } from "./add-commands";
import { CallName } from "./call-name";
import { IfBranches } from "./if-branches";
import { ItemRow } from "./item-row";
import { LoopBody } from "./loop-body";
import { ProcBody } from "./proc-body";

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
  const canProc = available.includes("PROC");
  const names = definedNames(program);

  const setNode = (i: number, change: Partial<Instruction>) =>
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
      <div className="mb-4">
        <AddCommands
          available={available}
          label="Add a command"
          loops
          callNames={canProc ? names : undefined}
          freeName={canProc ? nextFreeName(program) : undefined}
          onAdd={(node) => onChange([...program, node])}
        />
      </div>
      {program.length > 0 && (
        <ol className="grid max-w-[560px] gap-1" aria-label={`${idPrefix} program`}>
          {program.map((p, i) => (
            <li key={i} className="border-t-2 border-ink py-1">
              <ItemRow
                index={i}
                count={program.length}
                text={nodeLabel(p)}
                name={`step ${i + 1}`}
                onMove={(to) => onChange(moveItem(program, i, to))}
                onRemove={() => onChange(program.filter((_, j) => j !== i))}
              />
              {isLoop(p) && (
                <LoopBody
                  node={p}
                  name={`loop ${i + 1}`}
                  idPrefix={`loop-${i}`}
                  available={available}
                  callNames={canProc ? names : undefined}
                  onCount={(count) => setNode(i, { count })}
                  onUntil={(until) => setNode(i, { until })}
                  onBody={(body) => setNode(i, { body })}
                />
              )}
              {isProc(p) && (
                <ProcBody
                  node={p}
                  available={available}
                  idPrefix={`${idPrefix}-proc-${i}`}
                  onBody={(body) => setNode(i, { body })}
                />
              )}
              {isCall(p) && (
                <CallName
                  value={p.name ?? ""}
                  names={names}
                  id={`${idPrefix}-call-${i}`}
                  where={`step ${i + 1}`}
                  onChange={(name) => setNode(i, { name })}
                />
              )}
              {isIf(p) && (
                <IfBranches
                  node={asIf(p)}
                  where={`step ${i + 1}`}
                  idPrefix={`${idPrefix}-if-${i}`}
                  primitives={primitivesOf(available)}
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
