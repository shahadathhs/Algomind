"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionEndedError } from "@/lib/api/errors";
import { apiMessage } from "@/lib/admin/messages";
import { orderBody, type Tree } from "@/lib/admin/campaign-tree";
import { useAdminApi } from "../use-admin-api";

/** The campaign tree, its unsaved order edits, and the calls that change it. */
export function useCampaignTree() {
  const api = useAdminApi();
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTree(await api.getCampaign());
      setDirty(false);
    } catch (err) {
      if (!(err instanceof SessionEndedError)) setError(apiMessage(err));
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

  /** Runs a change, then reloads. Resolves true only when the change succeeded. */
  const apply = useCallback(
    async (action: () => Promise<unknown>, done?: string): Promise<boolean> => {
      setNotice(null);
      setError(null);
      try {
        await action();
        if (done) setNotice(done);
        await load();
        return true;
      } catch (err) {
        if (!(err instanceof SessionEndedError)) setError(apiMessage(err));
        return false;
      }
    },
    [load],
  );

  /**
   * Runs a change unless the order has edits that were not saved yet: the reload that follows a
   * change replaces the tree and would drop them. Resolves true only when the change succeeded.
   */
  const run = useCallback(
    async (action: () => Promise<unknown>, done?: string): Promise<boolean> => {
      if (dirty) {
        setError("The order has unsaved changes. Save the order first.");
        return false;
      }
      return apply(action, done);
    },
    [apply, dirty],
  );

  function edit(next: Tree) {
    setTree(next);
    setDirty(true);
    setNotice(null);
  }

  /** Saves the order edits; it is the one change that may run while they are unsaved. */
  async function saveOrder() {
    if (!tree) return;
    setSaving(true);
    await apply(() => api.saveOrder(orderBody(tree)), "Order saved.");
    setSaving(false);
  }

  return { api, tree, error, notice, dirty, saving, load, run, edit, saveOrder };
}
