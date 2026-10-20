"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookX,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  PartyPopper,
  RotateCcw,
  X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/book/markdown";
import { Note } from "@/components/book/note";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Session } from "@/content/schema";
import { completeUnitAction, setStepAction } from "@/features/study/actions";
import { cn } from "@/lib/utils";

import { Blocks } from "./block-view";
import { useCommitmentFlush } from "./commitment";
import { ChecklistField, RatingField } from "./fields";
import { usePlayer } from "./player-context";
import { SaveIndicator } from "./save-indicator";
import { StepTimer } from "./step-timer";

type Props = {
  session: Session;
  chapterLabel: string;
  initialStep: number;
  backHref: string;
};

/**
 * A session, one step at a time. Step 0 says what to read; then the
 * notebook's steps; then the closing with its scale. Everything typed is
 * saved as it is written.
 */
export function SessionPlayer({ session, chapterLabel, initialStep, backHref }: Props) {
  const { slug, values, flush, status, orientation } = usePlayer();
  const flushCommitment = useCommitmentFlush();
  const closingIndex = session.steps.length + 1;
  // Session 0 has no closing: its last step finishes it.
  const lastIndex = session.closing ? closingIndex : session.steps.length;
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), lastIndex));
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const current = step >= 1 && step <= session.steps.length ? session.steps[step - 1] : undefined;
  const ratingKey = session.closing?.rating?.type === "rating" ? session.closing.rating.key : null;
  const rating = ratingKey ? Number(values[ratingKey] ?? 0) : 0;

  useEffect(() => {
    if (initialStep === 0) return;
    void setStepAction(slug, session.id, Math.min(initialStep, lastIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(next: number) {
    const target = Math.min(Math.max(next, 0), lastIndex);
    setStep(target);
    const url = new URL(window.location.href);
    url.searchParams.set("paso", String(target));
    window.history.replaceState(window.history.state, "", url);
    top.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
    if (target >= 1) void setStepAction(slug, session.id, target);
    void flush();
    void flushCommitment();
  }

  function finish() {
    start(async () => {
      await Promise.all([flush(), flushCommitment()]);
      const res = await completeUnitAction(slug, session.id, ratingKey ? rating || null : null);
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data?.status ?? "completed");
      window.scrollTo({ top: 0 });
    });
  }

  if (result) return <FinishedScreen session={session} status={result} backHref={backHref} />;

  const needsAck = current?.closedBook && !acknowledged.has(step);
  const nextLabel =
    step === 0
      ? `Empezar: Paso 1 · ${session.steps[0]?.title ?? ""}`
      : step < session.steps.length
        ? `Paso ${step + 1} · ${session.steps[step]?.title}`
        : step === session.steps.length && session.closing
          ? "Ir al cierre"
          : null;
  const hasPersonalQuestions = current?.blocks.some(
    (b) => b.type === "question" && b.qtype === "C",
  );

  return (
    <div ref={top} className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/92 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3 sm:px-6">
          <Link
            href={backHref as Route}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-10")}
            aria-label="Salir de la sesión"
          >
            <X className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">
              {session.number === "0" ? "Sesión 0" : `Sesión ${session.number}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {step === 0
                ? "Inicio"
                : step === closingIndex
                  ? "Cierre"
                  : `Paso ${step} de ${session.steps.length}`}
            </p>
          </div>
          <div className="flex w-[4.5rem] justify-end">
            {current?.minutes ? (
              <StepTimer key={`${session.id}-${step}`} seconds={current.minutes * 60} />
            ) : null}
          </div>
        </div>
        <nav aria-label="Pasos" className="mx-auto flex max-w-2xl gap-1 px-3 pb-2 sm:px-6">
          {[...session.steps.map((s) => s.title), ...(session.closing ? ["Cierre"] : [])].map(
            (title, i) => {
              const n = i + 1;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => go(n)}
                  aria-label={`Ir a ${title}`}
                  aria-current={step === n ? "step" : undefined}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    n < step ? "bg-primary" : n === step ? "bg-primary/60" : "bg-muted",
                  )}
                />
              );
            },
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-36 sm:px-6">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-primary">{chapterLabel}</p>
              <h1 className="mt-1 font-serif text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
                {session.title}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" /> {session.minutes} minutos
                {session.optional ? " · opcional" : ""}
              </p>
            </div>
            <Blocks blocks={session.intro} />
            <section className="rounded-2xl border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Cómo es esta sesión</p>
              <ol className="space-y-2">
                {session.steps.map((s) => (
                  <li key={s.n} className="flex items-center gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {s.n}
                    </span>
                    <span className="flex-1">{s.title}</span>
                    {s.closedBook && (
                      <BookX
                        className="size-4 text-muted-foreground"
                        aria-label="Con el libro cerrado"
                      />
                    )}
                    {s.minutes && (
                      <span className="text-muted-foreground tabular-nums">{s.minutes} min</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}

        {current && needsAck && (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <BookX className="size-10" />
            </span>
            <h2 className="mt-6 font-serif text-2xl font-semibold">Cierra el libro</h2>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Responde de memoria y con tus palabras. Esforzarte por recordar, aunque recuerdes
              poco, es lo que más fija lo aprendido.
            </p>
            <Button
              className="mt-8 h-12 px-6 text-base"
              onClick={() => setAcknowledged((s) => new Set(s).add(step))}
            >
              Ya lo cerré
            </Button>
          </div>
        )}

        {current && !needsAck && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-primary">
                Paso {current.n}
                {current.minutes ? ` · ${current.minutes} min` : ""}
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">{current.title}</h2>
              {current.closedBook && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
                  <BookX className="size-4" /> Con el libro cerrado
                </p>
              )}
            </div>
            <Blocks blocks={current.blocks} />
            {hasPersonalQuestions && orientation && (
              <details className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium">
                  Orientación para tu reflexión
                  <ChevronDown className="size-5 transition group-open:rotate-180" />
                </summary>
                <div className="border-t p-4">
                  <Markdown md={orientation} />
                </div>
              </details>
            )}
          </div>
        )}

        {step === closingIndex && session.closing && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-primary">Cierre</p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">¿Cómo te fue?</h2>
            </div>
            {session.closing.checklist?.type === "checklist" && (
              <ChecklistField block={session.closing.checklist} />
            )}
            {session.closing.rating?.type === "rating" && (
              <RatingField block={session.closing.rating} />
            )}
            {session.closing.beforeAdvancing && (
              <div className={cn("rounded-xl", rating > 0 && rating <= 2 && "ring-2 ring-warning")}>
                <Note md={`**Antes de avanzar:** ${session.closing.beforeAdvancing}`} />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
          <SaveIndicator status={status} className="self-center" />
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                className="h-12 px-4"
                onClick={() => go(step - 1)}
                aria-label="Paso anterior"
              >
                <ArrowLeft className="size-5" />
              </Button>
            )}
            {needsAck ? null : nextLabel ? (
              <Button className="h-12 min-w-0 flex-1 text-base" onClick={() => go(step + 1)}>
                <span className="truncate">{nextLabel}</span>
                <ArrowRight className="size-5 shrink-0" />
              </Button>
            ) : (
              <Button
                className="h-12 flex-1 text-base"
                onClick={finish}
                disabled={pending || (ratingKey !== null && !rating)}
              >
                {pending ? <Loader2 className="animate-spin" /> : <Check className="size-5" />}
                {ratingKey && !rating ? "Elige tu autoevaluación" : "Terminar sesión"}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function FinishedScreen({
  session,
  status,
  backHref,
}: {
  session: Session;
  status: string;
  backHref: string;
}) {
  const reinforce = status === "needs_review";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span
        className={cn(
          "flex size-20 items-center justify-center rounded-full",
          reinforce ? "bg-warning/25 text-warning-foreground" : "bg-success/15 text-success",
        )}
      >
        {reinforce ? <RotateCcw className="size-10" /> : <PartyPopper className="size-10" />}
      </span>
      <h1 className="mt-6 font-serif text-2xl font-semibold">
        {reinforce ? "Refuerza antes de avanzar" : "¡Sesión completada!"}
      </h1>
      {reinforce && session.closing?.beforeAdvancing ? (
        <div className="mt-4 text-left">
          <Markdown md={session.closing.beforeAdvancing} />
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">
          Tu compromiso quedó en Compromisos. Los repasos del capítulo se programan solos al
          terminar su última sesión.
        </p>
      )}
      <div className="mt-8 flex w-full flex-col gap-2">
        <Link href="/" className={cn(buttonVariants(), "h-12 text-base")}>
          Volver a Hoy
        </Link>
        <Link
          href={backHref as Route}
          className={cn(buttonVariants({ variant: "outline" }), "h-12 text-base")}
        >
          Ver el capítulo
        </Link>
      </div>
    </main>
  );
}
