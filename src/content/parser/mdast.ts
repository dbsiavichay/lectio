import type { List, ListItem, Node, Paragraph, Root, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

export function parseMarkdown(src: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(src);
}

/** The node's original Markdown, exactly as written in the source. */
export function sliceMd(src: string, node: Node): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return "";
  return src.slice(start, end).trim();
}

export const plain = (node: Node) => toString(node).trim();

/** A line of underscores: a blank line to write on. Markdown reads it as a rule. */
export const isBlank = (node: RootContent | undefined): boolean => node?.type === "thematicBreak";

export function slugify(text: string, max = 48): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Mn}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "campo"
  );
}

/** Text of a list item without its marker and with nested lines dedented. */
export function itemMd(src: string, item: ListItem): string {
  const raw = sliceMd(src, item).replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "");
  const lines = raw.split("\n");
  return [lines[0], ...lines.slice(1).map((l) => l.replace(/^ {2,3}/, ""))].join("\n").trim();
}

/** Inline fill-in: "Enseñanza que quiero aplicar: ______". */
export const INLINE_BLANK = /\s*_{4,}\s*$/;

export const isInlineField = (item: ListItem) => {
  const first = item.children[0];
  return (
    first?.type === "paragraph" && INLINE_BLANK.test(plain(first)) && item.children.length === 1
  );
};

export const isBlankItem = (item: ListItem) =>
  item.children.length > 0 && item.children.every((c) => c.type === "thematicBreak");

export const isParagraph = (node: RootContent | undefined): node is Paragraph =>
  node?.type === "paragraph";

export const isList = (node: RootContent | undefined): node is List => node?.type === "list";

/** Paragraph text that starts with a bold label: "**Antes de avanzar:** …" → "Antes de avanzar". */
export function boldLead(node: Paragraph): string | undefined {
  const first = node.children[0];
  if (first?.type !== "strong") return undefined;
  return plain(first).replace(/:\s*$/, "");
}

/** Drops a leading "**Label:**" from a Markdown string. */
export const stripBoldLead = (md: string) => md.replace(/^\*\*[^*]+\*\*\s*/, "").trim();
