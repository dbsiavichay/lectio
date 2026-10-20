import { bookSchema, type Block, type Book, type Manifest, type SectionEntry } from "../schema";
import { parseAnswers } from "./answers";
import { KeyRegistry } from "./blocks";
import { parseNotebook } from "./notebook";
import { parseReviews } from "./reviews";

export type BookSources = {
  manifest: Manifest;
  /** Entries of sections.json; extra fields (the PDF positions) are dropped. */
  sections: SectionEntry[];
  method: string;
  notebook: string;
  answers: string;
  reviews: string;
};

export type ImportReport = {
  /** Problems that stop the import. */
  errors: string[];
  /** Worth a look, but the book is usable. */
  warnings: string[];
  stats: {
    parts: number;
    chapters: number;
    sessions: number;
    evaluations: number;
    questions: number;
    answers: number;
    pendingAnswers: number;
    reviewCards: number;
    blockReviews: number;
    references: number;
  };
};

const REF = /\[\[([^\]]+)\]\]/g;

/** Every block of the book, wherever it lives. */
export function* allBlocks(
  book: Pick<Book, "units" | "chapters" | "parts" | "front" | "reviews">,
): Generator<Block> {
  for (const unit of Object.values(book.units)) {
    if (unit.kind === "session") {
      yield* unit.intro;
      for (const step of unit.steps) yield* step.blocks;
      if (unit.closing?.checklist) yield unit.closing.checklist;
      if (unit.closing?.rating) yield unit.closing.rating;
    } else yield* unit.blocks;
  }
  for (const ch of book.chapters) yield* ch.intro;
  for (const p of book.parts) yield* p.intro;
  if (book.front) yield* book.front.intro;
  yield* book.reviews.weekly;
  for (const card of Object.values(book.reviews.cards)) {
    yield* card.d1;
    yield* card.d3;
    yield* card.d7;
    yield* card.d14;
  }
  for (const b of Object.values(book.reviews.blocks)) yield* b.blocks;
  for (const s of book.reviews.final?.sections ?? []) yield* s.blocks;
}

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => collectStrings(v, out));
}

/**
 * Builds a book from its sources and checks it against itself: references
 * against the section index, questions against the answer guide, review
 * sheets against the questions they cite.
 */
export function parseBook(sources: BookSources): { book: Book | null; report: ImportReport } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keys = new KeyRegistry();
  const duplicateCodes: string[] = [];

  const notebook = parseNotebook(sources.notebook, keys, duplicateCodes);
  const guide = parseAnswers(sources.answers);
  const reviews = parseReviews(sources.reviews, keys);
  errors.push(...notebook.problems, ...guide.problems, ...reviews.problems);
  for (const code of duplicateCodes) errors.push(`Código de pregunta duplicado: ${code}`);

  const book: Book = {
    formatVersion: 1,
    slug: sources.manifest.slug,
    title: sources.manifest.title,
    subtitle: sources.manifest.subtitle ?? null,
    author: sources.manifest.author,
    edition: sources.manifest.edition ?? null,
    bible: sources.manifest.bible ?? null,
    method: { ...sources.manifest.method, guide: sources.method.trim() },
    sections: sources.sections.map(({ id, kind, ref, title, level, chapter }) => ({
      id,
      kind,
      ref,
      title,
      level,
      ...(chapter !== undefined ? { chapter } : {}),
    })),
    parts: notebook.parts,
    chapters: notebook.chapters.map((c) => ({
      ...c,
      private: sources.manifest.privateChapters.includes(c.n),
    })),
    front: notebook.front,
    units: notebook.units,
    answers: guide.answers,
    orientations: guide.orientations,
    reviews: reviews.reviews,
  };

  // Questions learn where to check them (step 3) and whether the guide answers them.
  const questions = new Map<string, Extract<Block, { type: "question" }>>();
  for (const block of allBlocks(book))
    if (block.type === "question") questions.set(block.code, block);
  for (const unit of Object.values(book.units)) {
    if (unit.kind !== "session") continue;
    for (const step of unit.steps) {
      for (const block of step.blocks) {
        if (block.type !== "verify") continue;
        for (const item of block.items) {
          const q = questions.get(item.code);
          if (q) q.verify = item.where;
          else errors.push(`«Dónde comprobar» cita una pregunta que no existe: ${item.code}`);
        }
      }
    }
  }
  for (const q of questions.values()) {
    q.hasAnswer = Boolean(book.answers[q.code]);
    const expectsAnswer = q.qtype === "A" || q.qtype === "B" || /-EF-/.test(q.code);
    if (expectsAnswer && !q.hasAnswer)
      warnings.push(`La pregunta ${q.code} no tiene respuesta en la guía`);
  }
  for (const code of Object.keys(book.answers)) {
    if (!questions.has(code)) errors.push(`La guía responde una pregunta que no existe: ${code}`);
  }
  for (const block of allBlocks(book)) {
    if (block.type === "requestion") {
      for (const code of block.codes)
        if (!questions.has(code)) errors.push(`Un repaso cita una pregunta que no existe: ${code}`);
    }
  }

  // Every [[reference]] must name an entry of the section index.
  const known = new Set(book.sections.map((s) => s.ref));
  const strings: string[] = [];
  collectStrings({ ...book, sections: [] }, strings);
  let references = 0;
  const unknown = new Set<string>();
  for (const s of strings) {
    for (const m of s.matchAll(REF)) {
      references++;
      if (!known.has(m[1]!)) unknown.add(m[1]!);
    }
  }
  for (const ref of unknown)
    errors.push(`Referencia a una sección que no está en el índice: [[${ref}]]`);

  for (const ch of book.chapters) {
    if (!book.reviews.cards[String(ch.n)])
      warnings.push(`El capítulo ${ch.n} no tiene ficha de repaso`);
  }

  const units = Object.values(book.units);
  const report: ImportReport = {
    errors,
    warnings,
    stats: {
      parts: book.parts.length,
      chapters: book.chapters.length,
      sessions: units.filter((u) => u.kind === "session").length,
      evaluations: units.filter((u) => u.kind === "evaluation").length,
      questions: questions.size,
      answers: Object.keys(book.answers).length,
      pendingAnswers: Object.values(book.answers).filter((a) => a.pending).length,
      reviewCards: Object.keys(book.reviews.cards).length,
      blockReviews: Object.keys(book.reviews.blocks).length,
      references,
    },
  };

  const parsed = bookSchema.safeParse(book);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 20)) {
      errors.push(`Estructura inválida en ${issue.path.join(".")}: ${issue.message}`);
    }
  }
  return { book: errors.length ? null : book, report };
}
