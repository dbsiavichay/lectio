import { CalendarClock, Check, ChevronRight, ClipboardCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { StaticBlocks } from "@/components/book/blocks-static";
import { RefChip } from "@/components/book/ref-chip";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionTitle } from "@/components/section-title";
import { STATUS_LABEL, StatusBadge } from "@/components/status-dot";
import { chapterEvaluation, chapterOf, chapterSessions } from "@/content/navigation";
import { BookScope } from "@/features/books/book-scope";
import { ReauthGate } from "@/features/auth/reauth-gate";
import { studyFor } from "@/features/study/context";
import { getProgress, isDone } from "@/features/study/progress";
import { listReviews, reviewSlug } from "@/features/study/reviews";
import { getAuth } from "@/lib/auth/dal";
import { isPrivateUnlocked } from "@/lib/auth/session";
import { formatDate, todayIn } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const DAY_LABEL = {
  d1: "Día +1 · ficha y evaluación",
  d3: "Día +3 · preguntas esenciales",
  d7: "Día +7 · explicar en voz alta",
  d14: "Día +14 · enseñanza y aplicación",
} as const;

export default function ChapterPage({ params }: PageProps<"/libro/[slug]/capitulo/[n]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChapterView params={params} />
    </Suspense>
  );
}

async function ChapterView({
  params,
}: {
  params: PageProps<"/libro/[slug]/capitulo/[n]">["params"];
}) {
  const { slug, n } = await params;
  const { user, book } = await studyFor(slug);
  const chapter = chapterOf(book, Number(n));
  if (!chapter) notFound();
  const base = `/libro/${book.slug}`;

  const auth = await getAuth();
  if (chapter.private && auth && !isPrivateUnlocked(auth.session)) {
    return (
      <div className="space-y-6">
        <BackLink href={base}>Libro</BackLink>
        <ReauthGate
          title={`Capítulo ${chapter.n} es privado`}
          description="Confirma que eres tú para abrirlo. Quedará abierto durante una hora."
        />
      </div>
    );
  }

  const progress = getProgress(user.id, book.slug);
  const sessions = chapterSessions(book, chapter.n);
  const evaluation = chapterEvaluation(book, chapter.n);
  const today = todayIn(user.timezone);
  const reviews = listReviews(user.id, book.slug).filter(
    (r) => r.ref === chapter.n && r.kind.startsWith("d"),
  );
  const sections = book.sections.filter((s) => s.chapter === chapter.n && s.kind === "section");
  const part = book.parts.find((p) => p.chapters.includes(chapter.n));

  return (
    <BookScope userId={user.id} book={book}>
      <div className="space-y-8">
        <header className="space-y-1">
          <BackLink href={base}>Libro</BackLink>
          <p className="text-sm font-semibold text-primary">
            Capítulo {chapter.n}
            {part ? ` · Parte ${part.n}` : ""}
          </p>
          <h1 className="font-serif text-2xl leading-tight font-semibold tracking-tight text-balance">
            {chapter.title}
          </h1>
        </header>

        {chapter.intro.length > 0 && <StaticBlocks blocks={chapter.intro} />}

        <section>
          <SectionTitle>Sesiones</SectionTitle>
          <ul className="space-y-2">
            {sessions.map((s) => {
              const p = progress.get(s.id);
              const status = p
                ? p.status === "in_progress"
                  ? "in_progress"
                  : p.status === "needs_review"
                    ? "needs_review"
                    : "completed"
                : "not_started";
              return (
                <li key={s.id}>
                  <Link
                    href={`${base}/sesion/${s.id}` as Route}
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40"
                  >
                    <StatusBadge status={status} className="text-xs">
                      {status === "completed" || status === "needs_review" ? undefined : s.number}
                    </StatusBadge>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">
                        Sesión {s.number} · {s.minutes} min
                      </span>
                      <span className="block leading-snug font-medium">{s.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {STATUS_LABEL[status]}
                        {p?.status === "in_progress" ? ` · paso ${p.currentStep}` : ""}
                        {p?.rating ? ` · autoevaluación ${p.rating}/4` : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
            {evaluation && (
              <li>
                <Link
                  href={`${base}/sesion/${evaluation.id}` as Route}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      isDone(progress.get(evaluation.id))
                        ? "bg-success text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isDone(progress.get(evaluation.id)) ? (
                      <Check className="size-5" />
                    ) : (
                      <ClipboardCheck className="size-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-medium">
                      Evaluación final del capítulo
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Sin el libro, idealmente al día siguiente de la última sesión
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )}
          </ul>
        </section>

        <section>
          <SectionTitle>Repasos del capítulo</SectionTitle>
          {reviews.length === 0 ? (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              Se programan solos cuando termines la última sesión del capítulo: días +1, +3, +7 y
              +14.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`${base}/repaso/${reviewSlug(r)}` as Route}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/60"
                  >
                    {r.completedAt ? (
                      <Check className="size-4 text-success" />
                    ) : (
                      <CalendarClock
                        className={cn(
                          "size-4",
                          r.dueOn < today ? "text-destructive" : "text-muted-foreground",
                        )}
                      />
                    )}
                    <span className="flex-1">{DAY_LABEL[r.kind as keyof typeof DAY_LABEL]}</span>
                    <span className="text-muted-foreground first-letter:uppercase">
                      {formatDate(r.dueOn, { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Secciones en tu libro</SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">
            Toca una sección para anotar en qué página de tu ejemplar empieza.
          </p>
          <ul className="space-y-2">
            {sections.map((s) => (
              <li key={s.id} style={{ paddingLeft: `${s.level * 1.1}rem` }}>
                <RefChip refText={s.ref} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </BookScope>
  );
}
