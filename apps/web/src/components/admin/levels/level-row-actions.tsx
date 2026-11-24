"use client";

import type { LevelSummary } from "@/lib/admin/admin-api";
import { TextAction } from "../text-action";

/** Duplicate, and delete with a confirmation for a level that never went live. */
export function LevelRowActions({
  level,
  confirming,
  duplicating,
  onDuplicate,
  onAskDelete,
  onConfirmDelete,
  onKeep,
}: {
  level: LevelSummary;
  confirming: boolean;
  /** A copy of this level is being created: Duplicate waits for it, so a second click cannot create two. */
  duplicating: boolean;
  onDuplicate: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onKeep: () => void;
}) {
  const deletable = level.status === "DRAFT" && level.publishedVersion === null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TextAction onClick={onDuplicate} disabled={duplicating}>
        Duplicate
      </TextAction>
      {deletable &&
        (confirming ? (
          <span className="flex items-center gap-3">
            <TextAction onClick={onConfirmDelete}>Confirm delete</TextAction>
            <TextAction onClick={onKeep}>Keep</TextAction>
          </span>
        ) : (
          <TextAction onClick={onAskDelete}>Delete</TextAction>
        ))}
    </div>
  );
}
