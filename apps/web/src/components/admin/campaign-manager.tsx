"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Caption } from "@/components/ui/caption";
import { ApiError, SessionEndedError } from "@/lib/api/errors";
import type { AdminCampaign, LevelSummary } from "@/lib/admin/admin-api";
import { Field, Notice, OutlineAction, PrimaryAction, StatusTile } from "./ui";
import { useAdminApi } from "./use-admin-api";

type Tree = AdminCampaign;

function messageOf(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "NOT_EMPTY") return "It still contains items. Move them out first.";
    return err.message;
  }
  return "The server could not be reached.";
}

function TextAction({
  children,
  ...button
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px] disabled:text-mute disabled:no-underline"
      {...button}
    >
      {children}
    </button>
  );
}

function swap<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** The order the API stores: every world and chapter once, with each chapter's levels in order. */
function orderBody(tree: Tree) {
  return {
    worlds: tree.worlds.map((w) => ({
      id: w.id,
      chapters: w.chapters.map((c) => ({ id: c.id, levels: c.levels.map((l) => l.id) })),
    })),
  };
}

/** Worlds, chapters, and the order of levels. Reordering is local until Save order. */
export function CampaignManager() {
  const api = useAdminApi();
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setTree(await api.getCampaign());
      setDirty(false);
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setError(messageOf(err));
    }
  }, [api]);

  useEffect(() => {
    // The state updates run after the request resolves, not synchronously in the effect.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function run(action: () => Promise<unknown>, done?: string) {
    setNotice(null);
    setError(null);
    try {
      await action();
      if (done) setNotice(done);
      await load();
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setError(messageOf(err));
    }
  }

  function edit(next: Tree) {
    setTree(next);
    setDirty(true);
    setNotice(null);
  }

  async function saveOrder() {
    if (!tree) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await api.saveOrder(orderBody(tree));
      setNotice("Order saved.");
      await load();
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  function moveWorld(i: number, to: number) {
    if (!tree) return;
    edit({ ...tree, worlds: swap(tree.worlds, i, to) });
  }

  function moveChapter(wi: number, ci: number, to: number) {
    if (!tree) return;
    edit({
      ...tree,
      worlds: tree.worlds.map((w, i) =>
        i === wi ? { ...w, chapters: swap(w.chapters, ci, to) } : w,
      ),
    });
  }

  function moveLevel(wi: number, ci: number, li: number, to: number) {
    if (!tree) return;
    edit({
      ...tree,
      worlds: tree.worlds.map((w, i) =>
        i !== wi
          ? w
          : {
              ...w,
              chapters: w.chapters.map((c, j) =>
                j === ci ? { ...c, levels: swap(c.levels, li, to) } : c,
              ),
            },
      ),
    });
  }

  /** Moves a level to the end of another chapter (or to unassigned when chapterId is empty). */
  function assign(level: LevelSummary, chapterId: string) {
    if (!tree) return;
    const stripped = tree.worlds.map((w) => ({
      ...w,
      chapters: w.chapters.map((c) => ({
        ...c,
        levels: c.levels.filter((l) => l.id !== level.id),
      })),
    }));
    const unassigned = tree.unassigned.filter((l) => l.id !== level.id);
    if (!chapterId) {
      edit({ worlds: stripped, unassigned: [...unassigned, level] });
      return;
    }
    edit({
      worlds: stripped.map((w) => ({
        ...w,
        chapters: w.chapters.map((c) =>
          c.id === chapterId ? { ...c, levels: [...c.levels, level] } : c,
        ),
      })),
      unassigned,
    });
  }

  if (error && !tree) {
    return (
      <div className="py-6">
        <Notice>{error}</Notice>
        <div className="mt-4">
          <OutlineAction type="button" onClick={() => void load()}>
            Try again
          </OutlineAction>
        </div>
      </div>
    );
  }
  if (!tree) {
    return (
      <p role="status" className="py-10 text-sm tracking-[2px] uppercase">
        Loading campaign
      </p>
    );
  }

  const chapterChoices = tree.worlds.flatMap((w) =>
    w.chapters.map((c) => ({ id: c.id, label: `${w.title} / ${c.title}` })),
  );

  function rename(kind: "world" | "chapter", id: string) {
    const title = editText.trim();
    if (!title) return;
    setEditing(null);
    void run(() =>
      kind === "world" ? api.updateWorld(id, { title }) : api.updateChapter(id, { title }),
    );
  }

  function renameForm(kind: "world" | "chapter", id: string) {
    return (
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          rename(kind, id);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <Field
          label={`Rename ${kind}`}
          id={`rename-${id}`}
          value={editText}
          maxLength={60}
          onChange={(e) => setEditText(e.target.value)}
        />
        <OutlineAction type="submit">Save name</OutlineAction>
        <OutlineAction type="button" onClick={() => setEditing(null)}>
          Cancel
        </OutlineAction>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs tracking-[2px] text-mute uppercase">Admin</p>
          <h1 className="text-[34px] leading-tight tracking-[1px] uppercase">Campaign</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <p role="status" className="text-sm tracking-[2px] uppercase">
            {saving ? "Saving" : dirty ? "Order not saved" : "Saved"}
          </p>
          <PrimaryAction type="button" onClick={() => void saveOrder()} disabled={!dirty || saving}>
            Save order
          </PrimaryAction>
        </div>
      </div>

      {notice && (
        <div className="mb-4">
          <Notice kind="info">{notice}</Notice>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      <NewWorldForm onCreate={(title) => run(() => api.createWorld({ title }), "World added.")} />

      {tree.worlds.length === 0 && (
        <p className="py-6 text-base font-semibold text-mute">No worlds yet. Add the first one.</p>
      )}

      <div className="grid gap-12">
        {tree.worlds.map((world, wi) => (
          <section key={world.id} aria-label={`World ${world.title}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
              <div>
                <Caption>World {wi + 1}</Caption>
                {editing === world.id ? (
                  renameForm("world", world.id)
                ) : (
                  <h2 className="text-[26px] leading-tight tracking-[1px] uppercase">
                    {world.title}
                  </h2>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4">
                <TextAction
                  disabled={wi === 0}
                  onClick={() => moveWorld(wi, wi - 1)}
                  aria-label={`Move ${world.title} up`}
                >
                  Up
                </TextAction>
                <TextAction
                  disabled={wi === tree.worlds.length - 1}
                  onClick={() => moveWorld(wi, wi + 1)}
                  aria-label={`Move ${world.title} down`}
                >
                  Down
                </TextAction>
                <TextAction
                  onClick={() => {
                    setEditing(world.id);
                    setEditText(world.title);
                  }}
                >
                  Rename
                </TextAction>
                <TextAction
                  onClick={() => void run(() => api.deleteWorld(world.id), "World deleted.")}
                  aria-label={`Delete world ${world.title}`}
                >
                  Delete
                </TextAction>
              </div>
            </div>

            <div className="mt-6 grid gap-8 pl-0 sm:pl-6">
              {world.chapters.map((chapter, ci) => (
                <div key={chapter.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Caption>Chapter {ci + 1}</Caption>
                      {editing === chapter.id ? (
                        renameForm("chapter", chapter.id)
                      ) : (
                        <h3 className="text-xl tracking-[1px] uppercase">{chapter.title}</h3>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4">
                      <TextAction
                        disabled={ci === 0}
                        onClick={() => moveChapter(wi, ci, ci - 1)}
                        aria-label={`Move chapter ${chapter.title} up`}
                      >
                        Up
                      </TextAction>
                      <TextAction
                        disabled={ci === world.chapters.length - 1}
                        onClick={() => moveChapter(wi, ci, ci + 1)}
                        aria-label={`Move chapter ${chapter.title} down`}
                      >
                        Down
                      </TextAction>
                      <TextAction
                        onClick={() => {
                          setEditing(chapter.id);
                          setEditText(chapter.title);
                        }}
                      >
                        Rename
                      </TextAction>
                      <TextAction
                        onClick={() =>
                          void run(() => api.deleteChapter(chapter.id), "Chapter deleted.")
                        }
                        aria-label={`Delete chapter ${chapter.title}`}
                      >
                        Delete
                      </TextAction>
                    </div>
                  </div>
                  {chapter.levels.length === 0 ? (
                    <p className="py-3 text-base font-semibold text-mute">
                      No levels in this chapter.
                    </p>
                  ) : (
                    <ol className="mt-2 grid">
                      {chapter.levels.map((level, li) => (
                        <LevelRow
                          key={level.id}
                          level={level}
                          index={li}
                          last={li === chapter.levels.length - 1}
                          chapterId={chapter.id}
                          choices={chapterChoices}
                          onMove={(to) => moveLevel(wi, ci, li, to)}
                          onAssign={(id) => assign(level, id)}
                        />
                      ))}
                    </ol>
                  )}
                </div>
              ))}
              <NewChapterForm
                worldTitle={world.title}
                onCreate={(title) =>
                  run(() => api.createChapter({ worldId: world.id, title }), "Chapter added.")
                }
              />
            </div>
          </section>
        ))}
      </div>

      <section aria-label="Unassigned levels" className="mt-14">
        <div className="border-b-2 border-ink pb-3">
          <h2 className="text-[26px] leading-tight tracking-[1px] uppercase">Unassigned</h2>
          <p className="mt-1 text-sm font-semibold text-mute">
            These levels never reach players until they are placed in a chapter.
          </p>
        </div>
        {tree.unassigned.length === 0 ? (
          <p className="py-4 text-base font-semibold text-mute">Every level is placed.</p>
        ) : (
          <ul className="grid">
            {tree.unassigned.map((level) => (
              <LevelRow
                key={level.id}
                level={level}
                chapterId=""
                choices={chapterChoices}
                onAssign={(id) => assign(level, id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LevelRow({
  level,
  index,
  last,
  chapterId,
  choices,
  onMove,
  onAssign,
}: {
  level: LevelSummary;
  index?: number;
  last?: boolean;
  chapterId: string;
  choices: { id: string; label: string }[];
  onMove?: (to: number) => void;
  onAssign: (chapterId: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-faint py-2">
      {index !== undefined && (
        <span className="w-8 text-sm tracking-[2px] tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <Link
        href={`/admin/levels/${level.id}`}
        className="grow text-base tracking-[1px] uppercase underline decoration-2 underline-offset-[6px]"
      >
        {level.title}
      </Link>
      <StatusTile status={level.status} />
      <div className="flex w-full flex-wrap items-center gap-x-5 sm:w-auto">
        {onMove && index !== undefined && (
          <>
            <TextAction
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
              aria-label={`Move ${level.title} up`}
            >
              Up
            </TextAction>
            <TextAction
              disabled={last}
              onClick={() => onMove(index + 1)}
              aria-label={`Move ${level.title} down`}
            >
              Down
            </TextAction>
          </>
        )}
        <label className="flex items-center gap-2 text-xs tracking-[2px] text-mute uppercase">
          <span className="sr-only">Place {level.title} in</span>
          <span aria-hidden="true">Place in</span>
          <select
            value={chapterId}
            onChange={(e) => onAssign(e.target.value)}
            className="h-11 border-2 border-ink bg-floor px-2 text-[13px] text-ink"
          >
            <option value="">Unassigned</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </li>
  );
}

function NewWorldForm({ onCreate }: { onCreate: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="mb-10">
        <OutlineAction type="button" onClick={() => setOpen(true)}>
          Add world
        </OutlineAction>
      </div>
    );
  }
  return (
    <form
      className="mb-10 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        void onCreate(title.trim()).then(() => {
          setTitle("");
          setOpen(false);
        });
      }}
    >
      <Field
        label="World title"
        id="new-world"
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
      />
      <OutlineAction type="submit">Add world</OutlineAction>
      <OutlineAction type="button" onClick={() => setOpen(false)}>
        Cancel
      </OutlineAction>
    </form>
  );
}

function NewChapterForm({
  worldTitle,
  onCreate,
}: {
  worldTitle: string;
  onCreate: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div>
        <OutlineAction type="button" onClick={() => setOpen(true)}>
          Add chapter to {worldTitle}
        </OutlineAction>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        void onCreate(title.trim()).then(() => {
          setTitle("");
          setOpen(false);
        });
      }}
    >
      <Field
        label={`Chapter title in ${worldTitle}`}
        id={`new-chapter-${worldTitle}`}
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
      />
      <OutlineAction type="submit">Add chapter</OutlineAction>
      <OutlineAction type="button" onClick={() => setOpen(false)}>
        Cancel
      </OutlineAction>
    </form>
  );
}
