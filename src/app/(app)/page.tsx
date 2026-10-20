import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  CalendarClock,
  Clock,
  NotebookPen,
  PartyPopper,
  RotateCcw,
  Target,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { SectionTitle } from "@/components/section-title";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { currentStudy, greeting } from "@/features/study/context";
import { computeToday, daysLate, type TodayReview } from "@/features/study/today";
import { formatDate, relativeDay } from "@/lib/schedule";
import { cn } from "@/lib/utils";

import { ReinforceButton } from "./reinforce-button";

export const metadata: Metadata = { title: "Hoy" };

export default function TodayPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const { user, book, enrollment } = await currentStudy();
  const hello = `${greeting(user.timezone)}, ${user.displayName.split(" ")[0]}`;

  if (!book || !enrollment) {
    return (
      <div className="space-y-8">
        <h1 className="font-serif text-2xl font-semibold">{hello}</h1>
        <div className="rounded-2xl border bg-card p-6 text-center">
          <BookMarked className="mx-auto size-10 text-primary" />
          <h2 className="mt-3 font-serif text-xl font-semibold">Empieza un libro</h2>
          <p className="mt-1 text-muted-foreground">
            Elige el libro que vas a estudiar y los días en que lo harás.
          </p>
          <Link href="/libros" className={cn(buttonVariants(), "mt-5 h-11 px-5 text-base")}>
            Ver la biblioteca
          </Link>
        </div>
      </div>
    );
  }

  const view = computeToday(user.id, user.timezone, book, enrollment);
  const base = `/libro/${book.slug}`;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{hello}</h1>
          <p className="text-muted-foreground first-letter:uppercase">
            {view.todayLabel} ·{" "}
            <Link href="/libros" className="underline-offset-2 hover:underline">
              {book.title}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Progress
            value={view.progress.percent}
            className="flex-1"
            aria-label="Avance del libro"
          />
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {view.progress.done}/{view.progress.total} sesiones
          </span>
        </div>
      </header>

      {view.finished && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
          <PartyPopper className="mx-auto size-10 text-success" />
          <h2 className="mt-3 font-serif text-xl font-semibold">¡Terminaste el libro!</h2>
          <p className="mt-1 text-muted-foreground">
            Vuelve a la evaluación final dentro de seis meses y compara tus respuestas.
          </p>
        </div>
      )}

      {view.next && (
        <section
          aria-labelledby="next-title"
          className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm sm:p-6"
        >
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80">
            {view.next.resumeStep ? "Continúa donde quedaste" : "Siguiente sesión"}
          </p>
          <p className="mt-3 text-sm opacity-85">
            {view.next.label} · {view.next.minutes} min
          </p>
          <h2
            id="next-title"
            className="mt-1 font-serif text-xl leading-snug font-semibold text-balance sm:text-2xl"
          >
            {view.next.title}
          </h2>
          <p className="mt-1 text-sm opacity-80">
            {view.next.chapter > 0 ? `Capítulo ${view.next.chapter}: ` : ""}
            {view.next.chapterTitle}
          </p>
          {!view.isStudyDay && !view.next.resumeStep && (
            <p className="mt-4 rounded-lg bg-primary-foreground/12 px-3 py-2 text-sm">
              Hoy no es día de sesión según tu plan. Si tienes tiempo, puedes adelantar.
            </p>
          )}
          <Link
            href={`${base}/sesion/${view.next.unitId}` as Route}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 text-base font-semibold text-primary transition hover:bg-primary-foreground/90 sm:w-auto"
          >
            {view.next.resumeStep
              ? `Continuar en el paso ${view.next.resumeStep}`
              : "Empezar sesión"}
            <ArrowRight className="size-5" />
          </Link>
        </section>
      )}

      {view.reinforce.length > 0 && (
        <section>
          <SectionTitle>Por reforzar</SectionTitle>
          <ul className="space-y-3">
            {view.reinforce.map((r) => (
              <li key={r.unitId} className="rounded-xl border border-warning/50 bg-warning/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-warning-foreground">
                  <RotateCcw className="size-4" /> {r.label}: {r.title}
                </p>
                {r.beforeAdvancing && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Antes de avanzar: {stripRefs(r.beforeAdvancing)}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`${base}/sesion/${r.unitId}` as Route}
                    className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
                  >
                    Abrir la sesión
                  </Link>
                  <ReinforceButton slug={book.slug} unitId={r.unitId} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.reviews.length > 0 && (
        <section>
          <SectionTitle>Repasos de hoy</SectionTitle>
          <ReviewList base={base} reviews={view.reviews} today={view.today} />
        </section>
      )}

      {view.commitments.length > 0 && (
        <section>
          <SectionTitle
            action={
              <Link href="/compromisos" className="text-sm text-primary">
                Ver todos
              </Link>
            }
          >
            Compromisos
          </SectionTitle>
          <ul className="space-y-2">
            {view.commitments.map((c) => (
              <li key={c.unitId}>
                <Link
                  href="/compromisos"
                  className="flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40"
                >
                  <Target className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium">
                      {c.privateChapter ? "Compromiso de un capítulo privado" : c.action}
                    </span>
                    {c.dueOn && (
                      <span
                        className={cn(
                          "mt-1 block text-sm",
                          c.overdue ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {c.overdue ? "Venció " : "Vence "}
                        {relativeDay(c.dueOn, view.today)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.weekly.show && (
        <Link
          href={`${base}/diario` as Route}
          className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition hover:border-primary/40"
        >
          <NotebookPen className="size-8 shrink-0 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">Registro semanal</span>
            <span className="text-sm text-muted-foreground">
              Diez minutos para anotar qué aprendiste esta semana.
            </span>
          </span>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>
      )}

      {view.minutes > 0 && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
            view.heavy ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {view.heavy ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Clock className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            Tiempo estimado para hoy: <strong>{view.minutes} min</strong>.
            {view.heavy &&
              " Es un día cargado: puedes pasar los repasos del día +3 o +14 a mañana, pero no los saltes."}
          </span>
        </p>
      )}

      {view.upcoming.length > 0 && (
        <section>
          <SectionTitle>Próximos 7 días</SectionTitle>
          <ul className="divide-y rounded-xl border bg-card">
            {view.upcoming.map((r) => (
              <li key={r.slug} className="flex items-center gap-3 px-4 py-3 text-sm">
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="shrink-0 text-muted-foreground first-letter:uppercase">
                  {formatDate(r.dueOn, { weekday: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReviewList({
  base,
  reviews,
  today,
}: {
  base: string;
  reviews: TodayReview[];
  today: string;
}) {
  return (
    <ul className="space-y-2">
      {reviews.map((r) => (
        <li key={r.slug}>
          <Link
            href={`${base}/repaso/${r.slug}` as Route}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <RotateCcw className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{r.title}</span>
              <span className="block truncate text-sm text-muted-foreground">{r.subtitle}</span>
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="block text-muted-foreground tabular-nums">{r.minutes} min</span>
              {r.overdue && (
                <span className="block text-xs font-medium text-destructive">
                  {daysLate(r.dueOn, today) === 1
                    ? "Desde ayer"
                    : `Atrasado ${daysLate(r.dueOn, today)} días`}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Plain text for a short preview: references keep only the section name. */
function stripRefs(md: string) {
  return md
    .replace(/\[\[([^\]]+)\]\]/g, (_, ref: string) => `«${ref.split(" › ").at(-1)}»`)
    .replace(/\*\*/g, "");
}
