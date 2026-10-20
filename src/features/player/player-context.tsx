"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { Answer } from "@/content/schema";
import { gradeAnswerAction, revealAnswerAction } from "@/features/study/actions";

import { useAutosave, type SaveStatus } from "./use-autosave";

export type Grade = "correct" | "partial" | "missed";

type PlayerContextValue = {
  slug: string;
  unitId: string;
  values: Record<string, string>;
  set: (key: string, value: string) => void;
  flush: () => Promise<boolean>;
  status: SaveStatus;
  revealed: Record<string, Answer>;
  /** Answer fields whose guide is open: a review's fresh answer unlocks its own. */
  opened: Record<string, boolean>;
  grades: Record<string, Grade | null>;
  /** Opens a question's guide entry once its answer is saved. */
  reveal: (code: string, fieldKey?: string) => Promise<void>;
  grade: (code: string, grade: Grade | null) => void;
  /** Prompts of the book's questions, for the review re-answers and step 3. */
  prompts: Record<string, { prompt: string; qtype: string | null }>;
  orientation: string | null;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({
  slug,
  unitId,
  initialValues,
  initialRevealed,
  initialGrades,
  prompts,
  orientation,
  children,
}: {
  slug: string;
  unitId: string;
  initialValues: Record<string, string>;
  initialRevealed: Record<string, Answer>;
  initialGrades: Record<string, Grade | null>;
  prompts: PlayerContextValue["prompts"];
  orientation: string | null;
  children: ReactNode;
}) {
  const { values, set, flush, status } = useAutosave(slug, initialValues);
  const [revealed, setRevealed] = useState(initialRevealed);
  const [opened, setOpened] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(initialRevealed).map((code) => [code, true])),
  );
  const [grades, setGrades] = useState(initialGrades);

  const reveal = useCallback(
    async (code: string, fieldKey?: string) => {
      const saved = await flush();
      if (!saved) {
        toast.error("Tu respuesta aún no se guardó. Revisa la conexión e inténtalo de nuevo.");
        return;
      }
      const result = await revealAnswerAction(slug, code, fieldKey);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "No se encontró la respuesta" : result.error);
        return;
      }
      setRevealed((prev) => ({ ...prev, [code]: result.data! }));
      setOpened((prev) => ({ ...prev, [fieldKey ?? code]: true }));
    },
    [flush, slug],
  );

  const grade = useCallback(
    (code: string, value: Grade | null) => {
      setGrades((prev) => ({ ...prev, [code]: value }));
      void gradeAnswerAction(slug, code, value);
    },
    [slug],
  );

  const ctx = useMemo(
    () => ({
      slug,
      unitId,
      values,
      set,
      flush,
      status,
      revealed,
      opened,
      grades,
      reveal,
      grade,
      prompts,
      orientation,
    }),
    [
      slug,
      unitId,
      values,
      set,
      flush,
      status,
      revealed,
      opened,
      grades,
      reveal,
      grade,
      prompts,
      orientation,
    ],
  );
  return <PlayerContext value={ctx}>{children}</PlayerContext>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer debe usarse dentro de PlayerProvider");
  return ctx;
}
