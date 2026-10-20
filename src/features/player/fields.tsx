"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { useOptionalBook } from "@/components/book/book-context";
import { Markdown } from "@/components/book/markdown";
import type { Block } from "@/content/schema";
import { cn } from "@/lib/utils";

import { usePlayer } from "./player-context";

type BlockOf<T extends Block["type"]> = Extract<Block, { type: T }>;

/** A textarea that grows with its content, in the reading face. */
export function AutoTextarea({
  id,
  value,
  onChange,
  rows = 2,
  placeholder,
  className,
  ...rest
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Text typed before hydration lives only in the DOM (on a slow phone the
  // field is usable before React is): hand it over so it gets saved.
  useEffect(() => {
    const typed = ref.current?.value ?? "";
    if (typed && typed !== value) onChange(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "prose-reading block w-full resize-none rounded-xl border border-input bg-card px-3.5 py-3 leading-relaxed shadow-xs transition outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
      {...rest}
    />
  );
}

export function TextField({ block }: { block: BlockOf<"text"> }) {
  const { values, set } = usePlayer();
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-medium">
        <Markdown md={block.label} inline />
      </label>
      <AutoTextarea
        id={id}
        rows={Math.min(Math.max(block.lines, 2), 8)}
        value={values[block.key] ?? ""}
        onChange={(v) => set(block.key, v)}
      />
    </div>
  );
}

export function ItemsField({ block }: { block: BlockOf<"items"> }) {
  const { values, set } = usePlayer();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium">
        <Markdown md={block.label} inline />
      </legend>
      {Array.from({ length: block.count }, (_, i) => {
        const key = `${block.key}.${i + 1}`;
        return (
          <div key={key} className="flex items-start gap-2">
            <span className="mt-3 w-5 shrink-0 text-right text-sm font-semibold text-muted-foreground tabular-nums">
              {i + 1}.
            </span>
            <AutoTextarea
              rows={1}
              value={values[key] ?? ""}
              onChange={(v) => set(key, v)}
              aria-label={`${block.label} ${i + 1}`}
            />
          </div>
        );
      })}
    </fieldset>
  );
}

export function ChecklistField({ block }: { block: BlockOf<"checklist"> }) {
  const { values, set } = usePlayer();
  return (
    <ul className="space-y-2">
      {block.items.map((item, i) => {
        const key = `${block.key}.${i + 1}`;
        const on = values[key] === "1";
        return (
          <li key={key}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => set(key, on ? "" : "1")}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                on ? "border-success/40 bg-success/8" : "bg-card hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                  on ? "border-success bg-success text-white" : "border-input",
                )}
              >
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <Markdown md={item} inline className="text-[0.95rem] leading-snug" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function RatingField({
  block,
  onChange,
}: {
  block: BlockOf<"rating">;
  onChange?: (value: number) => void;
}) {
  const { values, set } = usePlayer();
  const book = useOptionalBook();
  const current = Number(values[block.key] ?? 0);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium">{block.label || "Autoevaluación (1–4)"}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {[1, 2, 3, 4].map((n) => {
          const on = current === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => {
                set(block.key, String(n));
                onChange?.(n);
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-base font-bold",
                  on ? "bg-primary-foreground text-primary" : "bg-muted",
                )}
              >
                {n}
              </span>
              <span className="text-sm leading-snug">{book?.scale[String(n)] ?? ""}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ChecksField({ block }: { block: BlockOf<"checks"> }) {
  const { values, set } = usePlayer();
  return (
    <fieldset>
      {block.label && (
        <legend className="mb-2 font-medium">
          <Markdown md={block.label} inline />
        </legend>
      )}
      <div className="flex flex-wrap gap-2">
        {block.items.map((item, i) => {
          const key = `${block.key}.${i + 1}`;
          const on = values[key] === "1";
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => set(key, on ? "" : "1")}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition",
                on
                  ? "border-warning bg-warning/20 text-warning-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {on && <Check className="size-4" />}
              <Markdown md={item} inline />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FieldsList({ block }: { block: BlockOf<"fields"> }) {
  const { values, set } = usePlayer();
  return (
    <div className="space-y-3">
      {block.items.map((item) => (
        <label key={item.key} className="block space-y-1.5">
          <span className="block text-sm font-medium">
            <Markdown md={item.label} inline />
          </span>
          <AutoTextarea
            rows={1}
            value={values[item.key] ?? ""}
            onChange={(v) => set(item.key, v)}
          />
        </label>
      ))}
    </div>
  );
}

/** Tables become one card per row on phones: wide grids don't fit. */
export function TableField({ block }: { block: BlockOf<"table"> }) {
  const { values, set } = usePlayer();
  const [first, ...columns] = block.columns;
  return (
    <div className="space-y-3">
      {block.rows.map((row, r) => (
        <div key={r} className="rounded-xl border bg-card p-3.5">
          <p className="mb-2 text-sm font-semibold">
            {first ? `${first}: ` : ""}
            {row}
          </p>
          <div className="space-y-2.5">
            {columns.map((col, c) => {
              const key = `${block.key}.${r + 1}.${c + 1}`;
              return (
                <label key={key} className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{col}</span>
                  <AutoTextarea rows={1} value={values[key] ?? ""} onChange={(v) => set(key, v)} />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
