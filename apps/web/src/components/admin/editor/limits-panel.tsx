"use client";

import { COMMANDS, MAX_COMMANDS, MAX_STEPS } from "@/lib/admin/level-model";
import { Field } from "../ui";
import type { ContentProps } from "./content-props";

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
