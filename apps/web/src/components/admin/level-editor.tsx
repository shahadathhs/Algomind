"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, SessionEndedError } from "@/lib/api/errors";
import type { Instruction, LevelContent, LevelView } from "@/lib/admin/admin-api";
import { apiMessage } from "@/lib/admin/messages";
import { clearBackup, readBackup, writeBackup } from "@/lib/admin/level-model";
import { BoardPanel } from "./editor/board-panel";
import { ChecksPanel } from "./editor/checks-panel";
import { DetailsPanel } from "./editor/details-panel";
import { LimitsPanel } from "./editor/limits-panel";
import { PlaytestPanel } from "./editor/playtest-panel";
import { PreviewPanel } from "./editor/preview-panel";
import { SolutionPanel } from "./editor/solution-panel";
import { Notice, OutlineAction, PrimaryAction, StatusTile } from "./ui";
import { useAdminApi } from "./use-admin-api";

const TABS = [
  { id: "details", label: "Details" },
  { id: "board", label: "Board" },
  { id: "limits", label: "Commands and limits" },
  { id: "solution", label: "Solution" },
  { id: "preview", label: "Preview" },
  { id: "playtest", label: "Playtest" },
  { id: "checks", label: "Checks" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type SaveState = "saved" | "unsaved" | "saving" | "failed";
const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving",
  failed: "Save failed",
};

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

/** The level editor: tabs over one draft, an explicit Save draft, and edits that survive a reload. */
export function LevelEditor({ levelId }: { levelId: string }) {
  const api = useAdminApi();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [level, setLevel] = useState<LevelView | null>(null);
  const [content, setContent] = useState<LevelContent | null>(null);
  const [solution, setSolution] = useState<Instruction[]>([]);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [restorable, setRestorable] = useState<ReturnType<typeof readBackup>>(null);
  const [tab, setTab] = useState<TabId>("details");
  const [playtestKey, setPlaytestKey] = useState(0);
  const [unpublishing, setUnpublishing] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const adopt = useCallback((view: LevelView) => {
    setLevel(view);
    if (view.draft) {
      setContent(view.draft.content);
      setSolution(view.draft.referenceSolution);
      setBaseUpdatedAt(view.draft.updatedAt);
    } else {
      setContent(null);
      setSolution([]);
      setBaseUpdatedAt("");
    }
    setSave("saved");
    setConflict(false);
  }, []);

  const fetchLevel = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const view = await api.getLevel(levelId);
      adopt(view);
      if (view.draft) {
        const backup = readBackup(levelId);
        setRestorable(backup && backup.baseUpdatedAt === view.draft.updatedAt ? backup : null);
        if (backup && backup.baseUpdatedAt !== view.draft.updatedAt) clearBackup(levelId);
      }
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
    setContent(nextContent);
    setSolution(nextSolution);
    setSave("unsaved");
    setNotice(null);
    setRestorable(null);
    writeBackup(levelId, {
      savedAt: Date.now(),
      baseUpdatedAt,
      content: nextContent,
      referenceSolution: nextSolution,
    });
  }

  async function saveDraft() {
    if (!content) return;
    setSave("saving");
    setNotice(null);
    try {
      const view = await api.saveDraft(levelId, {
        expectedUpdatedAt: baseUpdatedAt,
        content,
        referenceSolution: solution,
      });
      setLevel(view);
      if (view.draft) setBaseUpdatedAt(view.draft.updatedAt);
      clearBackup(levelId);
      setSave("saved");
    } catch (err) {
      if (err instanceof SessionEndedError) {
        setSave("failed");
        setNotice({
          kind: "error",
          text: "The session ended. Your edits are kept on this device.",
        });
        return;
      }
      setSave("failed");
      if (err instanceof ApiError && err.code === "DRAFT_CONFLICT") {
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
      if (!(err instanceof SessionEndedError)) setNotice({ kind: "error", text: apiMessage(err) });
    }
  }

  async function unpublish(archive: boolean) {
    setNotice(null);
    setUnpublishing(false);
    try {
      adopt(await api.unpublishLevel(levelId, archive));
      setNotice({
        kind: "info",
        text: archive
          ? "The level is archived and no longer offered to players."
          : "The level is no longer offered to players.",
      });
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setNotice({ kind: "error", text: apiMessage(err) });
    }
  }

  async function discardDraft() {
    setNotice(null);
    try {
      clearBackup(levelId);
      adopt(await api.discardDraft(levelId));
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setNotice({ kind: "error", text: apiMessage(err) });
    }
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const target = TABS[next]!;
    setTab(target.id);
    tabRefs.current[target.id]?.focus();
  }

  if (load.kind === "loading") {
    return (
      <p role="status" className="py-10 text-sm tracking-[2px] uppercase">
        Loading level
      </p>
    );
  }
  if (load.kind === "error" || !level) {
    return (
      <div className="py-6">
        <Notice>{load.kind === "error" ? load.message : "Level not found."}</Notice>
        <div className="mt-4 flex gap-3">
          <OutlineAction type="button" onClick={() => void fetchLevel()}>
            Try again
          </OutlineAction>
          <Link
            href="/admin/levels"
            className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px]"
          >
            All levels
          </Link>
        </div>
      </div>
    );
  }

  const dirty = save === "unsaved" || save === "saving" || save === "failed";
  const hasDraft = level.draft !== null && content !== null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-6">
        <Link
          href="/admin/levels"
          className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px]"
        >
          All levels
        </Link>
        <Link
          href={`/admin/history/${levelId}`}
          className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px]"
        >
          History
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs tracking-[2px] text-mute uppercase">
            {level.slug}
            {level.draft && ` · draft v${level.draft.versionNumber}`}
            {level.publishedVersion !== null && ` · live v${level.publishedVersion}`}
          </p>
          <h1 className="flex flex-wrap items-center gap-4 text-[34px] leading-tight tracking-[1px] uppercase">
            {content?.title || level.title}
            <StatusTile status={level.status} />
          </h1>
        </div>
        {hasDraft && (
          <div className="flex flex-wrap items-center gap-4">
            <p role="status" className="text-sm tracking-[2px] uppercase">
              {SAVE_LABEL[save]}
            </p>
            <PrimaryAction
              type="button"
              onClick={() => void saveDraft()}
              disabled={save === "saving" || save === "saved"}
            >
              Save draft
            </PrimaryAction>
          </div>
        )}
      </div>

      {notice && (
        <div className="mb-4">
          <Notice kind={notice.kind}>{notice.text}</Notice>
        </div>
      )}
      {level.status === "PUBLISHED" && (
        <div className="mb-6">
          {unpublishing ? (
            <div className="grid max-w-[640px] gap-3">
              <p className="text-base font-semibold">
                Unpublishing removes the level from what players fetch from now on. Copies already
                downloaded to devices stay there; this does not delete them.
              </p>
              <div className="flex flex-wrap gap-3">
                <OutlineAction type="button" onClick={() => void unpublish(false)}>
                  Confirm unpublish
                </OutlineAction>
                <OutlineAction type="button" onClick={() => void unpublish(true)}>
                  Unpublish and archive
                </OutlineAction>
                <OutlineAction type="button" onClick={() => setUnpublishing(false)}>
                  Cancel
                </OutlineAction>
              </div>
            </div>
          ) : (
            <OutlineAction type="button" onClick={() => setUnpublishing(true)}>
              Unpublish
            </OutlineAction>
          )}
        </div>
      )}
      {conflict && (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <p className="text-base font-semibold">
            Your edits are still on this page and in the local backup.
          </p>
          <OutlineAction type="button" onClick={() => void fetchLevel()}>
            Load the newer draft
          </OutlineAction>
        </div>
      )}
      {restorable && (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <p className="text-base font-semibold">
            Unsaved edits from {new Date(restorable.savedAt).toLocaleString()} were found on this
            device.
          </p>
          <OutlineAction
            type="button"
            onClick={() => {
              edit(restorable.content, restorable.referenceSolution);
              setRestorable(null);
            }}
          >
            Restore them
          </OutlineAction>
          <OutlineAction
            type="button"
            onClick={() => {
              clearBackup(levelId);
              setRestorable(null);
            }}
          >
            Discard them
          </OutlineAction>
        </div>
      )}

      {!hasDraft ? (
        <div className="grid max-w-[560px] gap-4 py-4">
          <p className="text-base font-semibold">
            This level is live as v{level.publishedVersion}. Players keep that version while you
            edit a new draft.
          </p>
          <div>
            <OutlineAction type="button" onClick={() => void startDraft()}>
              Start a new draft
            </OutlineAction>
          </div>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Level sections" className="mb-8 flex flex-wrap gap-2">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`tile inline-flex h-11 items-center px-5 text-[13px] tracking-[2px] uppercase ${
                  tab === t.id ? "bg-ink text-on-ink" : "bg-strip text-ink"
                }`}
                style={{ ["--chamfer" as string]: "10px" }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "details" && (
              <DetailsPanel
                content={content}
                slug={level.slug}
                onChange={(c) => edit(c, solution)}
              />
            )}
            {tab === "board" && (
              <BoardPanel content={content} onChange={(c) => edit(c, solution)} />
            )}
            {tab === "limits" && (
              <LimitsPanel content={content} onChange={(c) => edit(c, solution)} />
            )}
            {tab === "solution" && (
              <SolutionPanel
                content={content}
                solution={solution}
                onSolution={(s) => edit(content, s)}
              />
            )}
            {tab === "preview" && <PreviewPanel content={content} solution={solution} />}
            {tab === "playtest" && (
              <PlaytestPanel
                key={playtestKey}
                levelId={levelId}
                hasDraft
                commandsHint={solution.length}
                onRecorded={() => setPlaytestKey((n) => n + 1)}
              />
            )}
            {tab === "checks" && <ChecksPanel levelId={levelId} dirty={dirty} hasDraft />}
          </div>
          {level.publishedVersion !== null && (
            <div className="mt-10">
              <OutlineAction type="button" onClick={() => void discardDraft()}>
                Discard this draft
              </OutlineAction>
            </div>
          )}
        </>
      )}
    </div>
  );
}
