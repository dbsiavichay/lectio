import type { RootContent, Table } from "mdast";

import type { Block } from "../schema";
import {
  INLINE_BLANK,
  boldLead,
  isBlank,
  isBlankItem,
  isInlineField,
  isList,
  isParagraph,
  itemMd,
  plain,
  sliceMd,
  slugify,
} from "./mdast";

/** Hands out unique field keys inside a book. */
export class KeyRegistry {
  private used = new Set<string>();

  make(prefix: string, label: string): string {
    const base = `${prefix}.${slugify(labelText(label))}`;
    let key = base;
    for (let i = 2; this.used.has(key); i++) key = `${base}-${i}`;
    this.used.add(key);
    return key;
  }

  reserve(key: string): boolean {
    if (this.used.has(key)) return false;
    this.used.add(key);
    return true;
  }
}

export type BlockContext = {
  src: string;
  /** Prefix of the keys of the fields found here ("s1.1.p2"). */
  prefix: string;
  keys: KeyRegistry;
  /** The unit that owns a commitment found here. */
  unitId?: string;
  duplicateCodes?: string[];
};

/** Label words, without bold marks, parentheticals or the trailing colon. */
export function labelText(md: string): string {
  return md
    .replace(/\*\*|__|\*/g, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[:.\s]+$/, "")
    .trim();
}

export const RATING = /☐\s*1\s*·\s*☐\s*2\s*·\s*☐\s*3\s*·\s*☐\s*4/;
export const QUESTION = /^\*\*(C\d+-(?:S\d+-P\d+|EF-\d+|P\d+))\*\*\s*/;
const GUIDE_POINTER = /^Después consulta la guía de respuestas\.?$/;

/** Short paragraphs that introduce the blank lines after them. */
const labelLike = new WeakSet<Block>();

/**
 * Turns a run of Markdown nodes into notebook blocks, recognising the
 * notebook's conventions: blank lines to write on, questions with a code,
 * 1–4 scales, checklists, tables with empty cells, commitments and so on.
 * Anything else stays Markdown.
 */
export function toBlocks(nodes: RootContent[], ctx: BlockContext): Block[] {
  const out: Block[] = [];
  const md = (node: RootContent) => sliceMd(ctx.src, node);

  /** A preceding short paragraph becomes the label of the field that follows it. */
  const takeLabel = (): string | undefined => {
    const last = out.at(-1);
    if (last?.type === "markdown" && labelLike.has(last) && last.md.length <= 400) {
      out.pop();
      return last.md;
    }
    return undefined;
  };

  for (let i = 0; i < nodes.length;) {
    const node = nodes[i]!;

    if (isBlank(node)) {
      let lines = 0;
      while (isBlank(nodes[i])) {
        lines++;
        i++;
      }
      const label = takeLabel() ?? "Tu respuesta";
      out.push({
        type: "text",
        key: ctx.keys.make(ctx.prefix, label),
        label: cleanLabel(label),
        lines,
      });
      continue;
    }

    if (isParagraph(node)) {
      const source = md(node);
      const text = plain(node);

      const question = source.match(QUESTION);
      if (question) {
        const code = question[1]!;
        let prompt = source.slice(question[0].length);
        const type = prompt.match(/^\[([ABCD])\]\s*/);
        if (type) prompt = prompt.slice(type[0].length);
        const qtype = (type?.[1] ?? null) as "A" | "B" | "C" | "D" | null;
        let label = qtype === "C" || qtype === "D" ? "Mi reflexión personal" : "Mi respuesta";
        let j = i + 1;
        const next = nodes[j];
        if (isParagraph(next) && /^[^\n]{1,60}:$/.test(plain(next)) && isBlank(nodes[j + 1])) {
          label = plain(next).replace(/:$/, "");
          j++;
        }
        let lines = 0;
        while (isBlank(nodes[j])) {
          lines++;
          j++;
        }
        if (!ctx.keys.reserve(code)) ctx.duplicateCodes?.push(code);
        out.push({
          type: "question",
          key: code,
          code,
          qtype,
          interpretation: /\[Interpretaci[oó]n/.test(prompt),
          prompt: prompt.trim(),
          label,
          lines: Math.max(lines, 2),
          hasAnswer: false,
        });
        i = j;
        continue;
      }

      if (RATING.test(text)) {
        const [before = "", after = ""] = source.split(RATING);
        out.push({
          type: "rating",
          key: ctx.keys.make(ctx.prefix, "rating"),
          label: cleanLabel(before) || "Autoevaluación (1–4)",
        });
        const tail = after.replace(/^[.\s]+/, "").trim();
        if (tail) out.push({ type: "markdown", md: tail });
        i++;
        continue;
      }

      if (text.includes("☐")) {
        out.push(checksBlock(source, ctx));
        i++;
        continue;
      }

      const next = nodes[i + 1];
      if (/^Ideas basadas/i.test(text) && isList(next)) {
        out.push({
          type: "ideas",
          label: source,
          items: next.children.map((it) => itemMd(ctx.src, it)),
        });
        i += 2;
        continue;
      }

      if (boldLead(node) === "Mi compromiso práctico" && isList(next)) {
        let j = i + 2;
        let learnedLabel = "Qué aprendí al aplicarlo";
        const after = nodes[j];
        if (isParagraph(after) && /^Qué aprendí al aplicarlo/.test(plain(after))) {
          learnedLabel = cleanLabel(md(after));
          j++;
          while (isBlank(nodes[j])) j++;
        }
        out.push({ type: "commitment", key: ctx.unitId ?? ctx.prefix, learnedLabel });
        i = j;
        continue;
      }

      if (/^Dónde comprobar/i.test(text) && isList(next)) {
        const items = next.children.map((it) => {
          const line = itemMd(ctx.src, it);
          const m = line.match(/^(C\d+-[\w-]+)\s*→\s*([\s\S]*)$/);
          return m ? { code: m[1]!, where: m[2]!.trim() } : { code: "", where: line };
        });
        out.push({ type: "verify", items: items.filter((it) => it.code) });
        i += 2;
        continue;
      }

      if (GUIDE_POINTER.test(text)) {
        i++;
        continue;
      }

      const block: Block = { type: "markdown", md: source };
      if (source.length <= 400 && !source.includes("\n")) labelLike.add(block);
      out.push(block);
      i++;
      continue;
    }

    if (isList(node)) {
      const items = node.children;
      if (node.ordered && items.every(isBlankItem)) {
        const label = takeLabel() ?? "Tus respuestas";
        out.push({
          type: "items",
          key: ctx.keys.make(ctx.prefix, label),
          label: cleanLabel(label),
          count: items.length,
        });
        i++;
        continue;
      }
      if (items.every((it) => typeof it.checked === "boolean")) {
        out.push({
          type: "checklist",
          key: ctx.keys.make(ctx.prefix, "checklist"),
          items: items.map((it) => itemMd(ctx.src, it)),
        });
        i++;
        continue;
      }
      // A list can mix plain items, one-line fields and a 1–4 scale.
      let prose: string[] = [];
      let fields: { key: string; label: string }[] = [];
      const flushProse = () => {
        if (prose.length) out.push({ type: "markdown", md: prose.join("\n") });
        prose = [];
      };
      const flushFields = () => {
        if (fields.length)
          out.push({ type: "fields", key: ctx.keys.make(ctx.prefix, "campos"), items: fields });
        fields = [];
      };
      for (const item of items) {
        const text = plain(item);
        if (isInlineField(item)) {
          flushProse();
          const label = itemMd(ctx.src, item).replace(INLINE_BLANK, "").replace(/:\s*$/, "");
          fields.push({ key: ctx.keys.make(ctx.prefix, label), label });
          continue;
        }
        flushFields();
        if (RATING.test(text)) {
          flushProse();
          const [before = ""] = itemMd(ctx.src, item).split(RATING);
          out.push({
            type: "rating",
            key: ctx.keys.make(ctx.prefix, "rating"),
            label: cleanLabel(before),
          });
          continue;
        }
        prose.push(md(item as unknown as RootContent));
      }
      flushFields();
      flushProse();
      i++;
      continue;
    }

    if (node.type === "table") {
      const block = tableBlock(node, ctx);
      out.push(block ?? { type: "markdown", md: md(node) });
      i++;
      continue;
    }

    if (node.type === "blockquote") {
      const inner = md(node)
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join("\n")
        .trim();
      out.push({ type: "note", md: inner });
      i++;
      continue;
    }

    if (node.type === "html") {
      i++;
      continue;
    }

    out.push({ type: "markdown", md: md(node) });
    i++;
  }

  return mergeMarkdown(out);
}

/** "**Mi respuesta:**" → "Mi respuesta"; keeps inline emphasis and parentheticals. */
export function cleanLabel(md: string): string {
  return md
    .trim()
    .replace(/^\*\*([^*]+)\*\*/, "$1")
    .replace(/[:\s]+$/, "")
    .trim();
}

export function checksBlock(source: string, ctx: BlockContext): Block {
  const [label = "", ...rest] = source.split("☐");
  return {
    type: "checks",
    key: ctx.keys.make(ctx.prefix, label || "marcas"),
    label: cleanLabel(label),
    items: rest.map((s) => s.trim()).filter(Boolean),
  };
}

function tableBlock(node: Table, ctx: BlockContext): Block | undefined {
  const [head, ...rows] = node.children;
  if (!head) return undefined;
  const hasInputs = rows.some((r) => r.children.slice(1).some((c) => plain(c) === ""));
  if (!hasInputs) return undefined;
  return {
    type: "table",
    key: ctx.keys.make(ctx.prefix, "tabla"),
    columns: head.children.map(plain),
    rows: rows.map((r) => (r.children[0] ? plain(r.children[0]) : "")),
  };
}

function mergeMarkdown(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const last = out.at(-1);
    if (b.type === "markdown" && last?.type === "markdown") last.md = `${last.md}\n\n${b.md}`;
    else out.push(b.type === "markdown" ? { ...b } : b);
  }
  return out;
}
