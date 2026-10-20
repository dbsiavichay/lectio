import { BookText, ChevronRight, Lock, NotebookPen } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { STATUS_LABEL, StatusBadge } from "@/components/status-dot";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { requiredSessions } from "@/content/navigation";
import type { Book } from "@/content/schema";
import { getProgress, isDone } from "@/features/study/progress";
import { chapterStatus } from "@/features/study/status";
import { cn } from "@/lib/utils";

/** The book at a glance: parts, chapters and how far the user got in each. */
export function BookMap({ userId, book }: { userId: string; book: Book }) {
  const progress = getProgress(userId, book.slug);
  const required = requiredSessions(book);
  const done = required.filter((s) => isDone(progress.get(s.id))).length;
  const percent = required.length ? Math.round((done / required.length) * 100) : 0;
  const base = `/libro/${book.slug}`;

  const statuses = new Map(book.chapters.map((c) => [c.n, chapterStatus(book, c.n, progress)]));
  const openPart =
    book.parts.find((p) => p.chapters.some((c) => statuses.get(c)?.status !== "completed"))?.n ??
    book.parts[0]?.n;
  const front = book.front?.units[0];
  const frontProgress = front ? progress.get(front) : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="font-serif text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
            {book.title}
          </h1>
          <p className="text-muted-foreground">
            {book.subtitle ? `${book.subtitle} · ` : ""}
            {book.author}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={percent} className="flex-1" aria-label="Avance del libro" />
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{percent} %</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/metodo` as Route}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm hover:bg-muted"
          >
            <BookText className="size-4" /> Guía del método
          </Link>
          <Link
            href={`${base}/diario` as Route}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm hover:bg-muted"
          >
            <NotebookPen className="size-4" /> Diario semanal
          </Link>
        </div>
      </header>

      {front && book.front && (
        <Link
          href={`${base}/sesion/${front}` as Route}
          className="flex items-center gap-4 rounded-2xl border border-dashed bg-card p-4 transition hover:border-primary/40"
        >
          <StatusBadge
            status={
              frontProgress ? (isDone(frontProgress) ? "completed" : "in_progress") : "not_started"
            }
          >
            0
          </StatusBadge>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{book.front.title}</span>
            <span className="text-sm text-muted-foreground">Sesión 0 · opcional</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      )}

      <Accordion defaultValue={openPart ? [openPart] : []} className="space-y-3">
        {book.parts.map((part) => {
          const chapters = part.chapters.map((n) => book.chapters.find((c) => c.n === n)!);
          const partDone = chapters.filter((c) => statuses.get(c.n)?.status === "completed").length;
          return (
            <AccordionItem
              key={part.n}
              value={part.n}
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <AccordionTrigger className="px-4 py-4 hover:no-underline">
                <span className="text-left">
                  <span className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Parte {part.n} · {partDone}/{chapters.length}
                  </span>
                  <span className="mt-0.5 block font-serif text-lg leading-snug font-semibold">
                    {part.title}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2 [&_a]:no-underline">
                <ul>
                  {chapters.map((ch) => {
                    const st = statuses.get(ch.n)!;
                    return (
                      <li key={ch.n}>
                        <Link
                          href={`${base}/capitulo/${ch.n}` as Route}
                          className="flex items-center gap-3 border-t px-4 py-3 transition hover:bg-muted/60"
                        >
                          <StatusBadge status={st.status}>
                            {st.status === "completed" ? undefined : ch.n}
                          </StatusBadge>
                          <span className="min-w-0 flex-1">
                            <span className="block leading-snug font-medium">
                              {ch.private ? `Capítulo ${ch.n}` : ch.title}
                            </span>
                            <span
                              className={cn(
                                "flex items-center gap-1.5 text-sm",
                                st.status === "needs_review"
                                  ? "text-warning-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {ch.private && <Lock className="size-3.5" aria-label="Privado" />}
                              {st.status === "not_started"
                                ? `${st.total} sesiones`
                                : `${STATUS_LABEL[st.status]} · ${st.done}/${st.total}`}
                            </span>
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
