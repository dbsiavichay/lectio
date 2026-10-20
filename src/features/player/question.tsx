"use client";

import { BookOpenCheck, Check, Eye, Lock, Loader2, Minus, X } from "lucide-react";
import { useId, useState } from "react";

import { useOptionalBook } from "@/components/book/book-context";
import { Markdown } from "@/components/book/markdown";
import { Button } from "@/components/ui/button";
import type { Answer, Block } from "@/content/schema";
import { cn } from "@/lib/utils";

import { AutoTextarea } from "./fields";
import { usePlayer, type Grade } from "./player-context";

type QuestionBlock = Extract<Block, { type: "question" }>;

const TYPE_STYLE: Record<string, string> = {
  A: "bg-q-a/12 text-q-a ring-q-a/25",
  B: "bg-q-b/12 text-q-b ring-q-b/25",
  C: "bg-q-c/15 text-q-c ring-q-c/30",
  D: "bg-q-d/12 text-q-d ring-q-d/25",
};

export function TypeBadge({ qtype, code }: { qtype: string | null; code: string }) {
  const book = useOptionalBook();
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      {qtype && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1",
            TYPE_STYLE[qtype],
          )}
        >
          {qtype} · {book?.questionTypes[qtype] ?? ""}
        </span>
      )}
      <span className="font-medium tracking-wide text-muted-foreground tabular-nums">{code}</span>
    </span>
  );
}

/** A question to answer in writing. `fieldKey` lets a review store a fresh answer. */
export function QuestionCard({
  block,
  fieldKey = block.key,
  showReveal = false,
}: {
  block: QuestionBlock;
  fieldKey?: string;
  showReveal?: boolean;
}) {
  const { values, set } = usePlayer();
  const id = useId();
  return (
    <article className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <TypeBadge qtype={block.qtype} code={block.code} />
      <label htmlFor={id} className="block">
        <Markdown md={block.prompt} className="font-medium" />
      </label>
      <AutoTextarea
        id={id}
        rows={Math.min(Math.max(block.lines, 3), 8)}
        placeholder={block.label}
        value={values[fieldKey] ?? ""}
        onChange={(v) => set(fieldKey, v)}
      />
      {showReveal && block.hasAnswer && <RevealControl code={block.code} fieldKey={fieldKey} />}
    </article>
  );
}

/** "Ver guía": locked until the user has written an answer. */
export function RevealControl({ code, fieldKey = code }: { code: string; fieldKey?: string }) {
  const { values, revealed, opened, reveal } = usePlayer();
  const [busy, setBusy] = useState(false);
  const written = Boolean(values[fieldKey]?.trim());
  const answer = opened[fieldKey] ? revealed[code] : undefined;

  if (answer) return <AnswerPanel code={code} answer={answer} />;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        className="h-11 px-4"
        disabled={!written || busy}
        onClick={async () => {
          setBusy(true);
          await reveal(code, fieldKey);
          setBusy(false);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : written ? <Eye /> : <Lock />}
        Ver guía de respuesta
      </Button>
      {!written && (
        <span className="text-sm text-muted-foreground">Escribe primero tu respuesta.</span>
      )}
    </div>
  );
}

const GRADES: { value: Grade; label: string; icon: typeof Check; tone: string }[] = [
  { value: "correct", label: "Acerté", icon: Check, tone: "border-success bg-success text-white" },
  {
    value: "partial",
    label: "Parcial",
    icon: Minus,
    tone: "border-warning bg-warning text-warning-foreground",
  },
  {
    value: "missed",
    label: "Olvidé",
    icon: X,
    tone: "border-destructive bg-destructive text-white",
  },
];

export function AnswerPanel({ code, answer }: { code: string; answer: Answer }) {
  const { grades, grade } = usePlayer();
  const current = grades[code] ?? null;
  const parts: { label: string; md: string | null; tone?: string }[] = [
    { label: "Pendiente", md: answer.pending, tone: "bg-warning/15" },
    { label: "Dónde está en el libro", md: answer.reference },
    { label: "Lo que dice el texto", md: answer.textSays },
    { label: "Respuesta orientativa", md: answer.guide },
    { label: "Interpretación", md: answer.interpretation },
    ...answer.extra.map((e) => ({ label: e.label, md: e.md })),
    { label: "Una respuesta satisfactoria incluye", md: answer.satisfactory, tone: "bg-accent/60" },
  ];
  return (
    <section
      aria-label="Guía de respuesta"
      className="space-y-3 rounded-xl border border-primary/25 bg-background p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <BookOpenCheck className="size-4" /> Guía de respuesta
        {answer.title ? `: ${answer.title}` : ""}
      </p>
      {parts
        .filter((p) => p.md)
        .map((p, i) => (
          <div key={i} className={cn("rounded-lg", p.tone && `${p.tone} p-3`)}>
            {p.label && (
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {p.label}
              </p>
            )}
            <Markdown md={p.md!} />
          </div>
        ))}
      <div className="border-t pt-3">
        <p className="mb-2 text-sm font-medium">¿Cómo te fue?</p>
        <div className="grid grid-cols-3 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.value}
              type="button"
              aria-pressed={current === g.value}
              onClick={() => grade(code, current === g.value ? null : g.value)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition",
                current === g.value ? g.tone : "bg-card hover:bg-muted",
              )}
            >
              <g.icon className="size-4" /> {g.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Step 3: each question with the user's answer, where to check it, and its guide. */
export function VerifyList({ block }: { block: Extract<Block, { type: "verify" }> }) {
  const { values, prompts } = usePlayer();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Abre el libro donde se indica, compara y después mira la guía. Anota abajo qué acertaste y
        qué corregiste.
      </p>
      {block.items.map((item) => {
        const q = prompts[item.code];
        const answer = values[item.code]?.trim();
        return (
          <article key={item.code} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
            <TypeBadge qtype={q?.qtype ?? null} code={item.code} />
            {q && <Markdown md={q.prompt} className="font-medium" />}
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Tu respuesta
              </p>
              <p className="prose-reading mt-0.5 whitespace-pre-wrap">
                {answer || <span className="text-muted-foreground italic">Sin responder</span>}
              </p>
            </div>
            <p className="text-sm">
              <span className="font-medium">Comprueba en tu libro: </span>
              <Markdown md={item.where} inline />
            </p>
            <RevealControl code={item.code} />
          </article>
        );
      })}
    </div>
  );
}
