import type { Instruction, LevelContent, VersionView } from "./admin-api";

/** The unsaved-edit backup. It holds level content only, never tokens or credentials. */
export type DraftBackup = {
  savedAt: number;
  baseUpdatedAt: string;
  content: LevelContent;
  referenceSolution: Instruction[];
};

const BACKUP_PREFIX = "algomind-admin-draft:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when a stored value really is a backup, so a damaged entry is never offered to restore. */
function isBackup(value: unknown): value is DraftBackup {
  return (
    isRecord(value) &&
    typeof value.savedAt === "number" &&
    typeof value.baseUpdatedAt === "string" &&
    isRecord(value.content) &&
    Array.isArray(value.referenceSolution)
  );
}

export function readBackup(levelId: string): DraftBackup | null {
  try {
    const raw = window.localStorage.getItem(BACKUP_PREFIX + levelId);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isBackup(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeBackup(levelId: string, backup: DraftBackup): void {
  try {
    window.localStorage.setItem(BACKUP_PREFIX + levelId, JSON.stringify(backup));
  } catch {
    // Storage may be blocked; saving to the server is the real path.
  }
}

export function clearBackup(levelId: string): void {
  try {
    window.localStorage.removeItem(BACKUP_PREFIX + levelId);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Whether two JSON documents say the same thing, whatever the order of their keys: the server
 * stores content as JSONB, which reorders them, so text equality would miss a match.
 */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  // A key left undefined is not sent to the server, so it is not a difference.
  const keys = Object.keys(a).filter((k) => a[k] !== undefined);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]))
  );
}

/**
 * The backup to offer for a level whose draft is on the server, or null when there is none.
 *
 * A backup made on the server's current draft is simply unsaved work. One made on an older draft
 * (a save whose answer was lost, or a conflict) still holds the author's only copy until the
 * server holds exactly its edits; from then on it is obsolete and removed.
 */
export function restorableBackup(
  levelId: string,
  draft: Pick<VersionView, "updatedAt" | "content" | "referenceSolution">,
): DraftBackup | null {
  const backup = readBackup(levelId);
  if (!backup) return null;
  if (backup.baseUpdatedAt === draft.updatedAt) return backup;
  const onServer =
    sameJson(backup.content, draft.content) &&
    sameJson(backup.referenceSolution, draft.referenceSolution);
  if (!onServer) return backup;
  clearBackup(levelId);
  return null;
}
