import { allBlocks } from "./parser";
import type { Block, Book, Chapter, Evaluation, Session, Unit } from "./schema";

/** Sessions and evaluations in reading order; the optional front matter first. */
export function orderedUnits(book: Book): Unit[] {
  const ids = [...(book.front?.units ?? []), ...book.chapters.flatMap((c) => c.units)];
  return ids.map((id) => book.units[id]!).filter(Boolean);
}

export const isSession = (u: Unit | undefined): u is Session => u?.kind === "session";
export const isEvaluation = (u: Unit | undefined): u is Evaluation => u?.kind === "evaluation";

export function chapterSessions(book: Book, chapter: number): Session[] {
  const ch = book.chapters.find((c) => c.n === chapter);
  return (ch?.units ?? []).map((id) => book.units[id]).filter(isSession);
}

export function chapterEvaluation(book: Book, chapter: number): Evaluation | undefined {
  const ch = book.chapters.find((c) => c.n === chapter);
  return (ch?.units ?? []).map((id) => book.units[id]).find(isEvaluation);
}

export function chapterOf(book: Book, n: number): Chapter | undefined {
  return book.chapters.find((c) => c.n === n);
}

export function partOfChapter(book: Book, chapter: number) {
  return book.parts.find((p) => p.chapters.includes(chapter));
}

/** Required sessions (Session 0 is optional). */
export function requiredSessions(book: Book): Session[] {
  return orderedUnits(book)
    .filter(isSession)
    .filter((s) => !s.optional);
}

export function unitLabel(unit: Unit): string {
  return unit.kind === "session"
    ? unit.number === "0"
      ? "Sesión 0"
      : `Sesión ${unit.number}`
    : `Evaluación final · capítulo ${unit.chapter}`;
}

/** Keys of everything a block stores; composite blocks store one value per part. */
export function blockKeys(block: Block): string[] {
  switch (block.type) {
    case "question":
    case "text":
    case "rating":
      return [block.key];
    case "items":
      return Array.from({ length: block.count }, (_, i) => `${block.key}.${i + 1}`);
    case "checklist":
    case "checks":
      return block.items.map((_, i) => `${block.key}.${i + 1}`);
    case "fields":
      return block.items.map((i) => i.key);
    case "table":
      return block.rows.flatMap((_, r) =>
        block.columns.slice(1).map((_, c) => `${block.key}.${r + 1}.${c + 1}`),
      );
    case "requestion":
      return block.codes.map((code) => `${block.key}:${code}`);
    default:
      return [];
  }
}

const allowedCache = new WeakMap<Book, { exact: Set<string>; weekly: Set<string> }>();

/**
 * Whether a key names a field of this book. The weekly log repeats every
 * week, so its keys carry the week: "w:2026-W43:w.lo-mas-importante".
 */
export function isAllowedKey(book: Book, key: string): boolean {
  let cached = allowedCache.get(book);
  if (!cached) {
    const exact = new Set<string>();
    for (const block of allBlocks(book)) for (const k of blockKeys(block)) exact.add(k);
    const weekly = new Set<string>();
    for (const block of book.reviews.weekly) for (const k of blockKeys(block)) weekly.add(k);
    cached = { exact, weekly };
    allowedCache.set(book, cached);
  }
  if (cached.exact.has(key)) return true;
  const weekly = key.match(/^w:\d{4}-W\d{2}:(.+)$/);
  return Boolean(weekly && cached.weekly.has(weekly[1]!));
}

/** All the keys a unit's page reads. */
export function unitKeys(unit: Unit): string[] {
  const blocks: Block[] =
    unit.kind === "session"
      ? [
          ...unit.intro,
          ...unit.steps.flatMap((s) => s.blocks),
          ...(unit.closing?.checklist ? [unit.closing.checklist] : []),
          ...(unit.closing?.rating ? [unit.closing.rating] : []),
        ]
      : unit.blocks;
  return blocks.flatMap(blockKeys);
}

export function questionCodes(blocks: Block[]): string[] {
  return blocks.flatMap((b) =>
    b.type === "question" ? [b.code] : b.type === "requestion" ? b.codes : [],
  );
}

/** The same blocks with their keys under a prefix (the weekly log repeats every week). */
export function scopeKeys(blocks: Block[], prefix: string): Block[] {
  return blocks.map((b) => {
    if (b.type === "fields")
      return {
        ...b,
        key: `${prefix}${b.key}`,
        items: b.items.map((i) => ({ ...i, key: `${prefix}${i.key}` })),
      };
    if ("key" in b && b.type !== "question" && b.type !== "commitment")
      return { ...b, key: `${prefix}${b.key}` } as Block;
    return b;
  });
}
