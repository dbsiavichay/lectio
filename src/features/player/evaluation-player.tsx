"use client";

import { BookOpenCheck, Check, Loader2, PartyPopper, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import type { Evaluation } from "@/content/schema";
import { completeUnitAction } from "@/features/study/actions";
import { cn } from "@/lib/utils";

import { Blocks } from "./block-view";
import { usePlayer } from "./player-context";
import { SaveIndicator } from "./save-indicator";

/** A chapter's final evaluation: answer without help, then compare with the guide. */
export function EvaluationPlayer({
  evaluation,
  backHref,
  done,
}: {
  evaluation: Evaluation;
  backHref: string;
  done: boolean;
}) {
  const { slug, values, flush, status, revealed } = usePlayer();
  const questions = evaluation.blocks.filter((b) => b.type === "question");
  const anyRevealed = questions.some((q) => q.type === "question" && revealed[q.code]);
  const [compare, setCompare] = useState(done || anyRevealed);
  const [finished, setFinished] = useState(false);
  const [pending, start] = useTransition();
  const answered = questions.filter((q) => q.type === "question" && values[q.key]?.trim()).length;

  if (finished) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
          <PartyPopper className="size-10" />
        </span>
        <h1 className="mt-6 font-serif text-2xl font-semibold">Evaluación terminada</h1>
        <p className="mt-2 text-muted-foreground">
          Marca como hecho el repaso del día +1 si ya completaste también su ficha.
        </p>
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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/92 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3 sm:px-6">
          <Link
            href={backHref as Route}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-10")}
            aria-label="Salir"
          >
            <X className="size-5" />
          </Link>
          <p className="flex-1 truncate text-center text-sm font-semibold">{evaluation.title}</p>
          <span className="w-10" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-36 sm:px-6">
        <h1 className="mb-6 font-serif text-2xl font-semibold tracking-tight">
          {evaluation.title}
        </h1>
        <Blocks blocks={evaluation.blocks} options={{ revealQuestions: compare }} />
      </main>
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
          <SaveIndicator status={status} className="self-center" />
          {!compare ? (
            <Button
              className="h-12 text-base"
              onClick={() => {
                void flush();
                setCompare(true);
                window.scrollTo({ top: 0 });
              }}
              disabled={answered === 0}
            >
              <BookOpenCheck className="size-5" /> Comparar con la guía ({answered}/
              {questions.length} respondidas)
            </Button>
          ) : (
            <Button
              className="h-12 text-base"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await flush();
                  const res = await completeUnitAction(slug, evaluation.id, null);
                  if (!res.ok) return void toast.error(res.error);
                  setFinished(true);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Check className="size-5" />}
              Terminar evaluación
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
