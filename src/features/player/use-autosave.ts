"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveFieldsAction } from "@/features/study/actions";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

const DEBOUNCE_MS = 800;
const RETRY_MS = 5_000;
const backupKey = (slug: string) => `lectio:pending:${slug}`;

function readBackup(slug: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(backupKey(slug)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeBackup(slug: string, data: Record<string, string>) {
  try {
    if (Object.keys(data).length) localStorage.setItem(backupKey(slug), JSON.stringify(data));
    else localStorage.removeItem(backupKey(slug));
  } catch {
    // Private mode or full storage: the server copy is what matters.
  }
}

/**
 * Field values with autosave. Edits are sent in batches a moment after the
 * user stops typing; anything not yet confirmed is kept in localStorage and
 * retried, so a lost connection on the phone loses nothing.
 */
export function useAutosave(slug: string, initial: Record<string, string>) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef(new Map<string, string>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);
  // The retry timer calls the latest flush, so flush needn't depend on itself.
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const persistBackup = useCallback(() => {
    const backup = { ...readBackup(slug) };
    for (const [k, v] of pending.current) backup[k] = v;
    writeBackup(slug, backup);
  }, [slug]);

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    if (pending.current.size === 0) return true;
    const entries = [...pending.current.entries()];
    pending.current.clear();
    setStatus("saving");
    const run = (async () => {
      try {
        const result = await saveFieldsAction(slug, entries);
        if (!result.ok) throw new Error(result.error);
        const backup = readBackup(slug);
        for (const [k, v] of entries) if (backup[k] === v) delete backup[k];
        writeBackup(slug, backup);
        setStatus(pending.current.size ? "saving" : "saved");
        return true;
      } catch {
        for (const [k, v] of entries) if (!pending.current.has(k)) pending.current.set(k, v);
        persistBackup();
        setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        timer.current = setTimeout(() => void flushRef.current(), RETRY_MS);
        return false;
      }
    })();
    inFlight.current = run;
    const ok = await run;
    inFlight.current = null;
    return ok;
  }, [slug, persistBackup]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const set = useCallback(
    (key: string, value: string) => {
      setValues((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
      pending.current.set(key, value);
      persistBackup();
      setStatus("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [flush, persistBackup],
  );

  // Edits made offline in an earlier visit come back and are sent again.
  useEffect(() => {
    const backup = readBackup(slug);
    const relevant = Object.entries(backup);
    if (!relevant.length) return;
    // A one-time sync from localStorage after hydration: the server can't know
    // these edits, so they can't be part of the initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues((prev) => ({ ...prev, ...Object.fromEntries(relevant) }));
    for (const [k, v] of relevant) pending.current.set(k, v);
    void flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    const onOnline = () => void flush();
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      clearTimeout(timer.current);
    };
  }, [flush]);

  return { values, set, flush, status };
}
