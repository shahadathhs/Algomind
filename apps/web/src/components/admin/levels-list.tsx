"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Caption } from "@/components/ui/caption";
import { ApiError, SessionEndedError } from "@/lib/api/errors";
import type { Difficulty, LevelStatus, LevelSummary, Page } from "@/lib/admin/admin-api";
import { Field, Notice, OutlineAction, PrimaryAction, SelectField, StatusTile } from "./ui";
import { useAdminApi } from "./use-admin-api";

const PAGE_SIZE = 20;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PLAYTEST_LABEL: Record<string, string> = {
  NONE: "None",
  STALE: "Stale",
  FAILED: "Failed",
  SOLVED: "Solved",
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function placementText(level: LevelSummary): string {
  const p = level.placement;
  if (!p.chapterId) return "Unassigned";
  return `${p.worldTitle ?? "?"} / ${p.chapterTitle ?? "?"} / ${p.orderInChapter + 1}`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "The server could not be reached.";
}

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; page: Page<LevelSummary> };

/** The level table: search, filters, sort, paging, and the create, duplicate and delete actions. */
export function LevelsList() {
  const api = useAdminApi();
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | LevelStatus>("");
  const [placement, setPlacement] = useState<"" | "unassigned">("");
  const [sort, setSort] = useState<"updatedAt" | "title" | "slug" | "createdAt">("updatedAt");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      setView({ kind: "loading" });
      api
        .listLevels({
          q: q.trim() || undefined,
          status: status || undefined,
          unassigned: placement === "unassigned" ? true : undefined,
          sort,
          order: sort === "updatedAt" || sort === "createdAt" ? "desc" : "asc",
          page,
          pageSize: PAGE_SIZE,
        })
        .then(
          (result) => live && setView({ kind: "ready", page: result }),
          (err: unknown) => {
            if (!live || err instanceof SessionEndedError) return;
            setView({ kind: "error", message: messageOf(err) });
          },
        );
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [api, q, status, placement, sort, page, reload]);

  async function duplicate(level: LevelSummary) {
    setNotice(null);
    try {
      const copy = await api.duplicateLevel(level.id);
      router.push(`/admin/levels/${copy.id}`);
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setNotice(messageOf(err));
    }
  }

  async function remove(level: LevelSummary) {
    setNotice(null);
    setConfirmDelete(null);
    try {
      await api.deleteLevel(level.id);
      refresh();
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setNotice(messageOf(err));
    }
  }

  const rowActions = (level: LevelSummary) => (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void duplicate(level)}
        className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px]"
      >
        Duplicate
      </button>
      {level.status === "DRAFT" && level.publishedVersion === null && (
        <>
          {confirmDelete === level.id ? (
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void remove(level)}
                className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px]"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] text-mute uppercase"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(level.id)}
              className="inline-flex min-h-11 items-center text-[13px] font-bold tracking-[2px] uppercase underline decoration-2 underline-offset-[6px]"
            >
              Delete
            </button>
          )}
        </>
      )}
    </div>
  );

  const pageCount =
    view.kind === "ready" ? Math.max(1, Math.ceil(view.page.total / view.page.pageSize)) : 1;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs tracking-[2px] text-mute uppercase">Admin</p>
          <h1 className="text-[34px] leading-tight tracking-[1px] uppercase">Levels</h1>
        </div>
        {!creating && (
          <PrimaryAction type="button" onClick={() => setCreating(true)}>
            New level
          </PrimaryAction>
        )}
      </div>

      {creating && (
        <NewLevelForm
          onCancel={() => setCreating(false)}
          onCreated={(id) => router.push(`/admin/levels/${id}`)}
        />
      )}

      <form
        role="search"
        aria-label="Filter levels"
        onSubmit={(e) => e.preventDefault()}
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field
          label="Search"
          id="level-search"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Title or slug"
          autoComplete="off"
        />
        <SelectField
          label="Status"
          id="level-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | LevelStatus);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </SelectField>
        <SelectField
          label="Placement"
          id="level-placement"
          value={placement}
          onChange={(e) => {
            setPlacement(e.target.value as "" | "unassigned");
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="unassigned">Unassigned only</option>
        </SelectField>
        <SelectField
          label="Sort"
          id="level-sort"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as typeof sort);
            setPage(1);
          }}
        >
          <option value="updatedAt">Last updated</option>
          <option value="createdAt">Created</option>
          <option value="title">Title</option>
          <option value="slug">Slug</option>
        </SelectField>
      </form>

      {notice && (
        <div className="mb-4">
          <Notice>{notice}</Notice>
        </div>
      )}

      {view.kind === "loading" && (
        <p role="status" className="py-10 text-sm tracking-[2px] uppercase">
          Loading levels
        </p>
      )}
      {view.kind === "error" && (
        <div className="py-6">
          <Notice>{view.message}</Notice>
          <div className="mt-4">
            <OutlineAction type="button" onClick={refresh}>
              Try again
            </OutlineAction>
          </div>
        </div>
      )}
      {view.kind === "ready" && view.page.items.length === 0 && (
        <div className="py-10">
          <Caption>No levels</Caption>
          <p className="mt-2 max-w-[520px] text-base font-semibold text-mute">
            {q || status || placement
              ? "No level matches these filters."
              : "There are no levels yet. Create the first one."}
          </p>
        </div>
      )}
      {view.kind === "ready" && view.page.items.length > 0 && (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <caption className="sr-only">
                Levels, {view.page.total} in total, page {view.page.page} of {pageCount}
              </caption>
              <thead>
                <tr className="border-b-2 border-ink text-xs tracking-[2px] text-mute uppercase">
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Level
                  </th>
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Status
                  </th>
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Placement
                  </th>
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Par
                  </th>
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Playtest
                  </th>
                  <th scope="col" className="py-3 pr-4 font-bold">
                    Updated
                  </th>
                  <th scope="col" className="py-3 font-bold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.page.items.map((level) => (
                  <tr key={level.id} className="border-b border-faint align-top">
                    <td className="py-4 pr-4">
                      <Link
                        href={`/admin/levels/${level.id}`}
                        className="text-lg tracking-[1px] uppercase underline decoration-2 underline-offset-[6px]"
                      >
                        {level.title}
                      </Link>
                      <p className="mt-1 text-sm font-semibold text-mute">
                        {level.slug} · {level.difficulty}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex flex-col items-start gap-2">
                        <StatusTile status={level.status} />
                        {level.draftAhead && (
                          <span className="text-xs tracking-[2px] uppercase">Draft ahead</span>
                        )}
                        {level.publishedVersion !== null && (
                          <span className="text-xs tracking-[2px] text-mute uppercase">
                            Live v{level.publishedVersion}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-[15px] font-semibold">{placementText(level)}</td>
                    <td className="py-4 pr-4 text-[15px] font-semibold tabular-nums">
                      {level.par ? `${level.par.commands} commands` : "Not set"}
                    </td>
                    <td className="py-4 pr-4 text-[15px] font-semibold">
                      {level.playtestState ? PLAYTEST_LABEL[level.playtestState] : "No draft"}
                    </td>
                    <td className="py-4 pr-4 text-[15px] font-semibold">{when(level.updatedAt)}</td>
                    <td className="py-4">{rowActions(level)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid sm:hidden" aria-label="Levels">
            {view.page.items.map((level) => (
              <li key={level.id} className="border-b border-faint py-4">
                <Link
                  href={`/admin/levels/${level.id}`}
                  className="text-lg tracking-[1px] uppercase underline decoration-2 underline-offset-[6px]"
                >
                  {level.title}
                </Link>
                <p className="mt-1 text-sm font-semibold text-mute">
                  {level.slug} · {level.difficulty}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <StatusTile status={level.status} />
                  {level.draftAhead && (
                    <span className="text-xs tracking-[2px] uppercase">Draft ahead</span>
                  )}
                  {level.publishedVersion !== null && (
                    <span className="text-xs tracking-[2px] text-mute uppercase">
                      Live v{level.publishedVersion}
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px] font-semibold">
                  <dt className="text-mute">Placement</dt>
                  <dd>{placementText(level)}</dd>
                  <dt className="text-mute">Par</dt>
                  <dd>{level.par ? `${level.par.commands} commands` : "Not set"}</dd>
                  <dt className="text-mute">Playtest</dt>
                  <dd>{level.playtestState ? PLAYTEST_LABEL[level.playtestState] : "No draft"}</dd>
                  <dt className="text-mute">Updated</dt>
                  <dd>{when(level.updatedAt)}</dd>
                </dl>
                <div className="mt-2">{rowActions(level)}</div>
              </li>
            ))}
          </ul>
          <nav aria-label="Pages" className="mt-6 flex items-center gap-4">
            <OutlineAction
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </OutlineAction>
            <span className="text-sm tracking-[2px] uppercase tabular-nums">
              {view.page.page} / {pageCount}
            </span>
            <OutlineAction
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </OutlineAction>
          </nav>
        </>
      )}
    </div>
  );
}

function NewLevelForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const api = useAdminApi();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Enter a title.");
    if (!SLUG.test(slug)) {
      return setError("The slug uses lowercase letters, digits, and single hyphens.");
    }
    setBusy(true);
    try {
      const level = await api.createLevel({ slug, title: title.trim(), difficulty });
      onCreated(level.id);
    } catch (err) {
      if (err instanceof SessionEndedError) return;
      setError(
        err instanceof ApiError && err.code === "SLUG_TAKEN"
          ? "That slug is taken."
          : messageOf(err),
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-10 max-w-[560px]" aria-label="New level">
      <Caption as="h2" className="mb-4">
        New level
      </Caption>
      <div className="grid gap-4">
        <Field
          label="Title"
          id="new-title"
          value={title}
          maxLength={60}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          required
        />
        <Field
          label="Slug"
          id="new-slug"
          value={slug}
          maxLength={60}
          hint="The level's address. It cannot change once published."
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          required
        />
        <SelectField
          label="Difficulty"
          id="new-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </SelectField>
        {error && <Notice>{error}</Notice>}
        <div className="flex flex-wrap gap-3">
          <PrimaryAction type="submit" disabled={busy}>
            {busy ? "Creating" : "Create level"}
          </PrimaryAction>
          <OutlineAction type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </OutlineAction>
        </div>
      </div>
    </form>
  );
}
