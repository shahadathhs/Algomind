"use client";

import type { IfNode, Primitive } from "@/lib/admin/admin-api";
import { COMMANDS } from "@/lib/admin/level-model";
import { IF_LIMITS, SENSOR_LABELS } from "@/lib/admin/program-model";
import { SelectField } from "../ui";
import { BranchList } from "./branch-list";

/** The sensor and the two branches of one IF, shown indented under its row. */
export function IfBranches({
  node,
  where,
  idPrefix,
  primitives,
  onChange,
}: {
  node: IfNode;
  where: string;
  idPrefix: string;
  primitives: typeof COMMANDS;
  onChange: (next: IfNode) => void;
}) {
  const id = `${idPrefix}-sensor`;
  return (
    <div className="mt-2 mb-2 ml-8 grid gap-3 border-l-2 border-ink pl-4">
      <SelectField
        label="Sensor"
        id={id}
        value={node.when}
        onChange={(e) => onChange({ ...node, when: e.target.value })}
      >
        {Object.entries(SENSOR_LABELS).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </SelectField>
      {node.then.length === 0 && (
        <p className="text-sm font-semibold text-mute">
          The then branch is empty. Add a command to it; an if with an empty then is not a valid
          program.
        </p>
      )}
      <BranchList
        title="Then"
        items={node.then}
        max={IF_LIMITS.then.max}
        primitives={primitives}
        where={where}
        onChange={(then: Primitive[]) => onChange({ ...node, then })}
      />
      <BranchList
        title="Else"
        items={node.else}
        max={IF_LIMITS.else.max}
        primitives={primitives}
        where={where}
        onChange={(next: Primitive[]) => onChange({ ...node, else: next })}
      />
    </div>
  );
}
