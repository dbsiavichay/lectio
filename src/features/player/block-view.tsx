"use client";

import { Markdown } from "@/components/book/markdown";
import { Note } from "@/components/book/note";
import type { Block } from "@/content/schema";

import { CommitmentForm, IdeasList } from "./commitment";
import {
  ChecklistField,
  ChecksField,
  FieldsList,
  ItemsField,
  RatingField,
  TableField,
  TextField,
} from "./fields";
import { usePlayer } from "./player-context";
import { QuestionCard, RevealControl, TypeBadge, VerifyList } from "./question";
import { StepTimer } from "./step-timer";

export type BlockViewOptions = {
  /** Questions can open their guide right away (evaluations in "compare" mode). */
  revealQuestions?: boolean;
};

export function BlockView({ block, options = {} }: { block: Block; options?: BlockViewOptions }) {
  switch (block.type) {
    case "markdown":
      return <Markdown md={block.md} />;
    case "note":
      return <Note md={block.md} />;
    case "question":
      return <QuestionCard block={block} showReveal={options.revealQuestions} />;
    case "text":
      return <TextField block={block} />;
    case "items":
      return <ItemsField block={block} />;
    case "checklist":
      return <ChecklistField block={block} />;
    case "rating":
      return <RatingField block={block} />;
    case "checks":
      return <ChecksField block={block} />;
    case "ideas":
      return <IdeasList block={block} />;
    case "commitment":
      return <CommitmentForm block={block} />;
    case "verify":
      return <VerifyList block={block} />;
    case "fields":
      return <FieldsList block={block} />;
    case "table":
      return <TableField block={block} />;
    case "requestion":
      return <Requestion block={block} />;
    case "timer":
      return (
        <div className="space-y-4">
          <Markdown md={block.md} />
          <StepTimer key={block.md} seconds={block.seconds} size="lg" />
        </div>
      );
    default:
      return null;
  }
}

export function Blocks({ blocks, options }: { blocks: Block[]; options?: BlockViewOptions }) {
  return (
    <div className="space-y-6">
      {blocks.map((b, i) => (
        <BlockView key={"key" in b ? b.key : `${b.type}-${i}`} block={b} options={options} />
      ))}
    </div>
  );
}

/** The day +3 review: answer earlier questions again, then compare. */
function Requestion({ block }: { block: Extract<Block, { type: "requestion" }> }) {
  const { prompts, values } = usePlayer();
  return (
    <div className="space-y-4">
      <Markdown md={block.intro} />
      {block.codes.map((code) => {
        const q = prompts[code];
        const fieldKey = `${block.key}:${code}`;
        const original = values[code]?.trim();
        return (
          <article key={code} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
            <TypeBadge qtype={q?.qtype ?? null} code={code} />
            {q && <Markdown md={q.prompt} className="font-medium" />}
            <QuestionInline fieldKey={fieldKey} />
            {values[fieldKey]?.trim() && original && (
              <details className="rounded-lg bg-muted px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">
                  Comparar con tu respuesta de la sesión
                </summary>
                <p className="prose-reading mt-2 whitespace-pre-wrap">{original}</p>
              </details>
            )}
            <RevealControl code={code} fieldKey={fieldKey} />
          </article>
        );
      })}
    </div>
  );
}

function QuestionInline({ fieldKey }: { fieldKey: string }) {
  const { values, set } = usePlayer();
  return (
    <textarea
      rows={3}
      value={values[fieldKey] ?? ""}
      onChange={(e) => set(fieldKey, e.target.value)}
      placeholder="Responde de memoria"
      className="prose-reading block w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
    />
  );
}
