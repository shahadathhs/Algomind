"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, SessionEndedError } from "@/lib/api/errors";
import type { Instruction, LevelContent, LevelView } from "@/lib/admin/admin-api";
import {
  type DraftBackup,
  clearBackup,
  restorableBackup,
  writeBackup,
} from "@/lib/admin/draft-backup";
import { apiMessage } from "@/lib/admin/messages";
import { useAdminApi } from "../use-admin-api";

export type SaveState = "saved" | "unsaved" | "saving" | "failed";
export type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };
export type EditorNotice = { kind: "error" | "info"; text: string };

/** One level and its draft: loading, local edits with a backup, and the calls that change it. */
export function useLevelDraft(levelId: string) {
  const api = useAdminApi();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [level, setLevel] = useState<LevelView | null>(null);
  const [content, setContent] = useState<LevelContent | null>(null);
  const [solution, setSolution] = useState<Instruction[]>([]);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<EditorNotice | null>(null);
  const [conflict, setConflict] = useState(false);
  const [restorable, setRestorable] = useState<DraftBackup | null>(null);
  // How many edits were made so far, so a save can tell whether any came in while it ran.
  const editCount = useRef(0);
  // The backup of the latest edit, to move it onto the draft a save creates underneath it.
  const latestBackup = useRef<DraftBackup | null>(null);

  const adopt = useCallback((view: LevelView) => {
    setLevel(view);
    setContent(view.draft?.content ?? null);
    setSolution(view.draft?.referenceSolution ?? []);
    setBaseUpdatedAt(view.draft?.updatedAt ?? "");
    setSave("saved");
    setConflict(false);
  }, []);

  const fetchLevel = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const view = await api.getLevel(levelId);
      adopt(view);
      if (view.draft) setRestorable(restorableBackup(levelId, view.draft));
      setLoad({ kind: "ready" });
    } catch (err) {
      if (err instanceof SessionEndedError) return;
      setLoad({ kind: "error", message: apiMessage(err) });
    }
  }, [api, levelId, adopt]);

  useEffect(() => {
    // Loading starts the fetch; the setState calls inside run after the request, not synchronously.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void fetchLevel();
  }, [fetchLevel]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (save !== "unsaved" && save !== "failed") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [save]);

  function edit(nextContent: LevelContent, nextSolution: Instruction[]) {
    editCount.current += 1;
    setContent(nextContent);
    setSolution(nextSolution);
    setSave("unsaved");
    setNotice(null);
    setRestorable(null);
    const backup: DraftBackup = {
      savedAt: Date.now(),
      baseUpdatedAt,
      content: nextContent,
      referenceSolution: nextSolution,
    };
    latestBackup.current = backup;
    writeBackup(levelId, backup);
  }

  function fail(err: unknown) {
    if (!(err instanceof SessionEndedError)) setNotice({ kind: "error", text: apiMessage(err) });
  }

  /** Takes the server's answer to a save. An edit made while the request ran is not on the server. */
  function saved(view: LevelView, editsWhenSent: number) {
    const base = view.draft?.updatedAt ?? "";
    setLevel(view);
    setBaseUpdatedAt(base);
    if (editCount.current === editsWhenSent) {
      clearBackup(levelId);
      setSave("saved");
      return;
    }
    // The edits stay unsaved. Their backup now stands on the draft this save created, so that a
    // reload does not take it for stale.
    const latest = latestBackup.current;
    if (latest) writeBackup(levelId, { ...latest, baseUpdatedAt: base });
    setSave("unsaved");
  }

  async function saveDraft() {
    if (!content) return;
    const editsWhenSent = editCount.current;
    setSave("saving");
    setNotice(null);
    try {
      const view = await api.saveDraft(levelId, {
        expectedUpdatedAt: baseUpdatedAt,
        content,
        referenceSolution: solution,
      });
      saved(view, editsWhenSent);
    } catch (err) {
      setSave("failed");
      if (err instanceof SessionEndedError) {
        setNotice({
          kind: "error",
          text: "The session ended. Your edits are kept on this device.",
        });
      } else if (err instanceof ApiError && err.code === "DRAFT_CONFLICT") {
        setConflict(true);
        setNotice({
          kind: "error",
          text: "A newer version of this draft was saved elsewhere. Nothing was overwritten.",
        });
      } else {
        setNotice({ kind: "error", text: apiMessage(err) });
      }
    }
  }

  async function startDraft() {
    setNotice(null);
    try {
      adopt(await api.startDraft(levelId));
    } catch (err) {
      fail(err);
    }
  }

  async function unpublish(archive: boolean) {
    setNotice(null);
    try {
      adopt(await api.unpublishLevel(levelId, archive));
      setNotice({
        kind: "info",
        text: archive
          ? "The level is archived and no longer offered to players."
          : "The level is no longer offered to players.",
      });
    } catch (err) {
      fail(err);
    }
  }

  async function discardDraft() {
    setNotice(null);
    try {
      adopt(await api.discardDraft(levelId));
      // Only now is the backup worthless: a failed discard leaves the draft and its edits.
      clearBackup(levelId);
      setRestorable(null);
    } catch (err) {
      fail(err);
    }
  }

  function restoreBackup() {
    if (!restorable) return;
    edit(restorable.content, restorable.referenceSolution);
    setRestorable(null);
  }

  function dropBackup() {
    clearBackup(levelId);
    setRestorable(null);
  }

  return {
    load,
    level,
    content,
    solution,
    save,
    notice,
    conflict,
    restorable,
    fetchLevel,
    edit,
    saveDraft,
    startDraft,
    unpublish,
    discardDraft,
    restoreBackup,
    dropBackup,
  };
}
