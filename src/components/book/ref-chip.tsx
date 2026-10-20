"use client";

import { BookOpen, BookmarkPlus, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { SectionEntry } from "@/content/schema";

import { useOptionalBook } from "./book-context";

function shortLabel(entry: SectionEntry): string {
  if (entry.kind === "chapter") return `Cap. ${entry.chapter} (inicio)`;
  if (entry.kind !== "section") return entry.ref;
  const title = entry.title.length > 46 ? `${entry.title.slice(0, 44).trimEnd()}…` : entry.title;
  return `Cap. ${entry.chapter} · ${title}`;
}

/** A reference to the printed book: tap it to see where to look. */
export function RefChip({ refText }: { refText: string }) {
  const book = useOptionalBook();
  const [open, setOpen] = useState(false);
  const entry = book?.sectionByRef.get(refText);
  if (!book || !entry) return <span className="font-medium">«{refText.split(" › ").at(-1)}»</span>;
  const page = book.pages[entry.id];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-md bg-accent px-1.5 py-px align-baseline font-sans text-[0.82em] font-medium text-accent-foreground ring-primary/30 transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
      >
        <BookOpen className="size-[0.95em] shrink-0 translate-y-[0.12em]" aria-hidden />
        <span className="truncate">{shortLabel(entry)}</span>
        {page && <span className="shrink-0 text-accent-foreground/70">· p. {page}</span>}
      </button>
      {open && <RefSheet entry={entry} open={open} onOpenChange={setOpen} />}
    </>
  );
}

function RefSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: SectionEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const book = useOptionalBook()!;
  const page = book.pages[entry.id];
  const [draft, setDraft] = useState(page ? String(page) : "");
  const [saved, setSaved] = useState(false);

  const inChapter = book.sections.filter(
    (s) => s.chapter === entry.chapter && s.kind === "section",
  );
  const index = inChapter.findIndex((s) => s.id === entry.id);
  const prev = index > 0 ? inChapter[index - 1] : undefined;
  const next = index >= 0 ? inChapter[index + 1] : undefined;
  const parent =
    entry.level > 0
      ? inChapter
          .slice(0, index)
          .reverse()
          .find((s) => s.level < entry.level)
      : undefined;

  async function save() {
    const value = draft.trim() === "" ? null : Number(draft);
    if (value !== null && (!Number.isInteger(value) || value < 1)) return;
    await book.setPage(entry.id, value);
    setSaved(true);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="text-left">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Busca en tu libro
          </p>
          <DrawerTitle className="font-serif text-xl leading-snug">
            {entry.kind === "chapter" ? "Inicio del capítulo" : entry.title}
          </DrawerTitle>
          <DrawerDescription>
            {entry.chapter !== undefined
              ? `Capítulo ${entry.chapter}: ${book.chapterTitles[entry.chapter] ?? ""}`
              : entry.kind === "appendix"
                ? "Apéndices, al final del libro"
                : "Antes de los capítulos"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-2 text-sm">
          {(parent || prev || next) && (
            <dl className="space-y-2 rounded-lg bg-muted p-3">
              {parent && (
                <div>
                  <dt className="text-xs text-muted-foreground">Dentro de la sección</dt>
                  <dd className="font-medium">{parent.title}</dd>
                </div>
              )}
              {prev && (
                <div>
                  <dt className="text-xs text-muted-foreground">Viene después de</dt>
                  <dd className="font-medium">{prev.title}</dd>
                </div>
              )}
              {next && (
                <div>
                  <dt className="text-xs text-muted-foreground">Le sigue</dt>
                  <dd className="font-medium">{next.title}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="space-y-2">
            <label htmlFor={`page-${entry.id}`} className="flex items-center gap-1.5 font-medium">
              <BookmarkPlus className="size-4 text-primary" /> Mis páginas
            </label>
            <p className="text-muted-foreground">
              ¿En qué página de tu ejemplar empieza? La verás junto a la referencia.
            </p>
            <div className="flex gap-2">
              <Input
                id={`page-${entry.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Página"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSaved(false);
                }}
                className="h-11 max-w-32 text-base"
              />
              <Button type="button" variant="secondary" className="h-11 px-4" onClick={save}>
                {saved ? <Check /> : null}
                {saved ? "Guardada" : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
        <DrawerFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Listo
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
