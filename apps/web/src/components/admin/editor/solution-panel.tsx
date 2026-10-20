"use client";

import { useMemo } from "react";
import { Caption } from "@/components/ui/caption";
import type { Instruction, LevelContent } from "@/lib/admin/admin-api";
import { localCheck, offersIf, slotsOf } from "@/lib/admin/level-model";
import { Notice } from "../ui";
import { ProgramEditor } from "./program-editor";

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
          {par && (check.parIsReference ? ", this is par" : `, par ${par.commands}`)}
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
        {par && !offersIf(content) && slotsOf(solution) > par.commands && check.solved && (
          <Notice kind="info">A shorter solution exists: {par.commands} commands.</Notice>
        )}
      </div>
    </div>
  );
}
