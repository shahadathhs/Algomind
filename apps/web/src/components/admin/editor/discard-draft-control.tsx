"use client";

import { useState } from "react";
import { OutlineAction } from "../ui";

/** Discard with a confirmation that says what is lost with the draft. */
export function DiscardDraftControl({ onDiscard }: { onDiscard: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <OutlineAction type="button" onClick={() => setOpen(true)}>
        Discard this draft
      </OutlineAction>
    );
  }
  return (
    <div className="grid max-w-[640px] gap-3">
      <p className="text-base font-semibold">
        Discarding deletes this draft and the unsaved edits kept on this device. Players keep the
        live version.
      </p>
      <div className="flex flex-wrap gap-3">
        <OutlineAction
          type="button"
          onClick={() => {
            setOpen(false);
            onDiscard();
          }}
        >
          Confirm discard
        </OutlineAction>
        <OutlineAction type="button" onClick={() => setOpen(false)}>
          Cancel
        </OutlineAction>
      </div>
    </div>
  );
}
