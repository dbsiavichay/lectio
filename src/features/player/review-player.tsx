"use client";

import { Check, ClipboardCheck, Loader2, Undo2, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/book/markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Block } from "@/content/schema";
import { setReviewDoneAction } from "@/features/study/actions";
import { cn } from "@/lib/utils";

import { Blocks } from "./block-view";
import { usePlayer } from "./player-context";
import { SaveIndicator } from "./save-indicator";

export type ReviewSection = { title?: string; intro?: string; blocks: Block[] };

export function ReviewPlayer({
  title,
  subtitle,
  sections,
  reviewSlug,
  scheduled,
  initiallyDone,
  evaluation,
  commitments,
  backHref,
}: {
  title: string;
  subtitle: string;
  sections: ReviewSection[];
  reviewSlug: string;
  scheduled: boolean;
  initiallyDone: boolean;
  evaluation?: { href: string; done: boolean };
  commitments?: { unitLabel: string; action: string; status: string }[];
  backHref: string;
}) {
  const { slug, flush, status } = usePlayer();
  const [done, setDone] = useState(initiallyDone);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      await flush();
      const res = await setReviewDoneAction(slug, reviewSlug, !done);
      if (!res.ok) return void toast.error(res.error);
      setDone(!done);
      if (!done) toast.success("Repaso marcado como hecho");
    });

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
          <p className="flex-1 truncate text-center text-sm font-semibold">Repaso</p>
          <span className="w-10" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 pt-6 pb-36 sm:px-6">
        <div>
          <h1 className="font-serif text-2xl leading-tight font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Responde primero de memoria. Solo después consulta tus respuestas y la guía.
          </p>
        </div>
        {sections.map((s, i) => (
          <section key={i} className="space-y-4">
            {s.title && <h2 className="font-serif text-xl font-semibold">{s.title}</h2>}
            {s.intro && <Markdown md={s.intro} />}
            <Blocks blocks={s.blocks} />
          </section>
        ))}
        {evaluation && (
          <Link
            href={evaluation.href as Route}
            className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-card p-4 transition hover:border-primary"
          >
            <ClipboardCheck className="size-8 shrink-0 text-primary" />
            <span className="flex-1">
              <span className="block font-semibold">Evaluación final del capítulo</span>
              <span className="text-sm text-muted-foreground">
                {evaluation.done
                  ? "Ya la hiciste. Puedes revisarla."
                  : "Hazla hoy, junto con esta ficha (unos 20 min)."}
              </span>
            </span>
            {evaluation.done && <Check className="size-5 text-success" />}
          </Link>
        )}
        {commitments && commitments.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Tus compromisos del capítulo</h2>
            <ul className="space-y-2">
              {commitments.map((c, i) => (
                <li key={i} className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">
                    {c.unitLabel} · {c.status}
                  </p>
                  <p className="mt-1">
                    {c.action || (
                      <span className="text-muted-foreground italic">Sin acción definida</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            <Link href="/compromisos" className="text-sm font-medium text-primary">
              Actualizar en Compromisos
            </Link>
          </section>
        )}
      </main>
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
          <SaveIndicator status={status} className="self-center" />
          {scheduled ? (
            <Button
              className="h-12 text-base"
              variant={done ? "outline" : "default"}
              onClick={toggle}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : done ? (
                <Undo2 className="size-5" />
              ) : (
                <Check className="size-5" />
              )}
              {done ? "Hecho · deshacer" : "Marcar repaso como hecho"}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Este repaso todavía no está programado: se activa al terminar el capítulo.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
