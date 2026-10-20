"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { SectionEntry } from "@/content/schema";
import { saveSectionPageAction } from "@/features/study/actions";

export type BookClientData = {
  slug: string;
  title: string;
  sections: SectionEntry[];
  chapterTitles: Record<number, string>;
  /** Section id → page where it starts in the user's printed copy. */
  pages: Record<string, number>;
  scale: Record<string, string>;
  questionTypes: Record<string, string>;
};

type BookContextValue = BookClientData & {
  sectionByRef: Map<string, SectionEntry>;
  setPage: (sectionId: string, page: number | null) => Promise<void>;
};

const BookContext = createContext<BookContextValue | null>(null);

export function BookProvider({ data, children }: { data: BookClientData; children: ReactNode }) {
  const [pages, setPages] = useState(data.pages);
  const sectionByRef = useMemo(
    () => new Map(data.sections.map((s) => [s.ref, s])),
    [data.sections],
  );

  const setPage = useCallback(
    async (sectionId: string, page: number | null) => {
      const result = await saveSectionPageAction(data.slug, sectionId, page);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPages((prev) => {
        const next = { ...prev };
        if (page === null) delete next[sectionId];
        else next[sectionId] = page;
        return next;
      });
    },
    [data.slug],
  );

  const value = useMemo(
    () => ({ ...data, pages, sectionByRef, setPage }),
    [data, pages, sectionByRef, setPage],
  );
  return <BookContext value={value}>{children}</BookContext>;
}

export function useBook(): BookContextValue {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error("useBook debe usarse dentro de BookProvider");
  return ctx;
}

export function useOptionalBook(): BookContextValue | null {
  return useContext(BookContext);
}
