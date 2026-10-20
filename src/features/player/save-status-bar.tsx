"use client";

import { usePlayer } from "./player-context";
import { SaveIndicator } from "./save-indicator";

/** The autosave state, for pages without a player footer. */
export function SaveStatusBar() {
  const { status } = usePlayer();
  return (
    <p className="flex min-h-5 justify-end">
      <SaveIndicator status={status === "idle" ? "idle" : status} />
    </p>
  );
}
