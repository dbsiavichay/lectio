/**
 * One-off content migration: rewrites the PDF page references of a study
 * notebook ("p. 23", "pp. 23–26", "Cap. 3, pp. 47–52") as chapter › section
 * references ("[[Cap. 1 › Un testimonio personal]]") that work with any
 * printing of the book.
 *
 * It needs the book's section index (sections.json), whose entries carry the
 * PDF position of every heading, and the PDF's text split into one file per
 * page (001.txt, 002.txt…), used to locate quoted phrases when a section starts
 * in the middle of a cited page.
 *
 *   tsx scripts/content/convert-refs.ts \
 *     --book content/books/el-esposo-ejemplar --pages /path/to/pages \
 *     --files 02_cuaderno_de_estudio.md,03_guia_de_respuestas.md
 *
 * Reads <book>/original/<file>, writes <book>/source/<file> and prints a
 * report of the references it could not place on a single section.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

type Entry = {
  id: string;
  kind: "front" | "part" | "chapter" | "section" | "appendix" | "back";
  ref: string;
  title: string;
  level: number;
  chapter?: number;
  pdf: { page: number; line: number; lines: number; end?: number };
};

const { values } = parseArgs({
  options: {
    book: { type: "string" },
    pages: { type: "string" },
    files: { type: "string" },
  },
});
if (!values.book || !values.pages || !values.files) {
  console.error("Uso: convert-refs --book <dir> --pages <dir> --files a.md,b.md");
  process.exit(1);
}
const bookDir = values.book;
const pagesDir = values.pages;

const index: Entry[] = JSON.parse(
  fs.readFileSync(path.join(bookDir, "sections.json"), "utf8"),
).entries;

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const pos = (e: Entry) => e.pdf.page + e.pdf.line / Math.max(e.pdf.lines, 1);
const positioned = index
  .filter((e) => e.kind === "chapter" || e.kind === "section")
  .sort((a, b) => pos(a) - pos(b));
const ranged = index.filter((e) => e.pdf.end !== undefined && e.kind !== "chapter");

const pageCache = new Map<number, string[]>();
function pageLines(p: number): string[] {
  let lines = pageCache.get(p);
  if (!lines) {
    const file = path.join(pagesDir, `${String(p).padStart(3, "0")}.txt`);
    lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
    pageCache.set(p, lines);
  }
  return lines;
}

function rangedAt(page: number): Entry | undefined {
  return ranged.find((e) => page >= e.pdf.page && page <= (e.pdf.end ?? e.pdf.page));
}

/** The most specific entry whose heading is at or before the position. */
function entryAt(p: number): Entry | undefined {
  let found: Entry | undefined;
  for (const e of positioned) {
    if (pos(e) <= p + 1e-9) found = e;
    else break;
  }
  return found;
}

/** The section a subsection belongs to. */
function parentOf(e: Entry): Entry | undefined {
  if (e.kind !== "section" || e.level === 0) return undefined;
  for (let k = positioned.indexOf(e) - 1; k >= 0; k--) {
    const p = positioned[k]!;
    if (p.chapter !== e.chapter || p.kind !== "section") return undefined;
    if (p.level < e.level) return p;
  }
  return undefined;
}

/** A subsection inside the parent section. A chapter's intro never absorbs its sections. */
function isDescendant(child: Entry, parent: Entry): boolean {
  if (parent.kind !== "section" || child.chapter !== parent.chapter) return false;
  const i = positioned.indexOf(parent);
  const j = positioned.indexOf(child);
  if (j <= i) return false;
  for (let k = i + 1; k <= j; k++) {
    const e = positioned[k]!;
    if (e.chapter !== parent.chapter || (e.kind === "section" && e.level <= parent.level)) {
      return false;
    }
  }
  return true;
}

/**
 * Finds a quoted phrase, or a Bible reference ("Mateo 7:17"), in the PDF text
 * near the cited pages.
 */
function locate(phrase: string, from: number, to: number): number | undefined {
  const words = norm(phrase).split(" ").filter(Boolean);
  const isBibleRef = /\d+:\d+/.test(phrase);
  if (words.length < 3 && !isBibleRef) return undefined;
  const key = words.slice(0, isBibleRef ? words.length : 6).join(" ");
  for (let p = Math.max(1, from - 1); p <= to + 1; p++) {
    const lines = pageLines(p);
    const flat = lines.map(norm);
    const joined = flat.join(" ");
    const at = joined.indexOf(key);
    if (at < 0) continue;
    let acc = 0;
    for (let i = 0; i < flat.length; i++) {
      acc += flat[i]!.length + 1;
      if (acc > at) return p + i / Math.max(lines.length, 1);
    }
  }
  return undefined;
}

type Resolution = { entries: Entry[]; adjacent: boolean; ambiguous: boolean };

function resolveSpan(a: number, b: number, hints: number[]): Resolution {
  const front = rangedAt(a);
  if (front) {
    const list: Entry[] = [];
    for (let p = a; p <= b; p++) {
      const e = rangedAt(p) ?? entryAt(p + 0.5);
      if (e && !list.includes(e)) list.push(e);
    }
    return { entries: list, adjacent: true, ambiguous: false };
  }
  const inSpan = hints.filter((h) => h >= a && h < b + 1);
  const heads = positioned.filter((e) => e.pdf.page === a);
  const frac = (e: Entry) => e.pdf.line / Math.max(e.pdf.lines, 1);
  // The deepest heading near the top of the page: a chapter title followed by
  // its first section leaves no intro worth citing.
  const top = heads.filter((h) => frac(h) <= 0.15).at(-1);
  let startPos: number;
  let endPos: number;
  let fromHint = false;
  if (a === b) {
    fromHint = inSpan.length > 0;
    startPos = fromHint ? Math.min(...inSpan) : top ? pos(top) : a;
    endPos = fromHint ? Math.max(...inSpan) : a + 0.85;
  } else {
    // A range usually starts where a section starts on its first page; only a
    // quote placed before that heading says the previous section's tail is cited.
    const first = top ?? heads.find((h) => frac(h) < 0.85);
    const hintsOnA = inSpan.filter((h) => Math.floor(h) === a);
    const tailCited = first && hintsOnA.length > 0 && Math.min(...hintsOnA) < pos(first);
    startPos = first && !tailCited ? pos(first) : a;
    endPos = Math.max(b + 0.3, ...inSpan);
  }
  let start = entryAt(startPos);
  const end = entryAt(endPos);
  if (!start || !end) return { entries: [], adjacent: false, ambiguous: true };
  // Starting on a section's first subsection, right under its heading, cites the section.
  const parent = parentOf(start);
  if (
    !fromHint &&
    parent &&
    parent.pdf.page === start.pdf.page &&
    positioned.indexOf(start) === positioned.indexOf(parent) + 1
  ) {
    start = parent;
  }
  if (start === end || isDescendant(end, start)) {
    return { entries: [start], adjacent: true, ambiguous: false };
  }
  const adjacent = positioned.indexOf(end) === positioned.indexOf(start) + 1;
  return { entries: [start, end], adjacent, ambiguous: a === b && !inSpan.length };
}

const link = (e: Entry) => `[[${e.ref}]]`;

function render(r: Resolution): string {
  if (r.entries.length === 1) return link(r.entries[0]!);
  if (r.entries.length === 2 && r.adjacent)
    return `${link(r.entries[0]!)} y ${link(r.entries[1]!)}`;
  if (
    r.entries.length > 2 &&
    r.entries.every((e) => e.kind !== "chapter" && e.kind !== "section")
  ) {
    return r.entries
      .map(link)
      .join(", ")
      .replace(/, ([^,]*)$/, " y $1");
  }
  return `desde ${link(r.entries[0]!)} hasta ${link(r.entries.at(-1)!)}`;
}

function joinList(parts: string[]): string {
  const unique = [...new Set(parts)];
  if (unique.length === 1) return unique[0]!;
  return `${unique.slice(0, -1).join(", ")} y ${unique.at(-1)}`;
}

/**
 * Renders the spans of one page list ("pp. 144, 149 y 157–158") together:
 * overlapping or contiguous sections merge, so no section is named twice.
 */
function renderAll(resolutions: Resolution[]): string {
  const items: { key: number; text: string }[] = [];
  const intervals: [number, number][] = [];
  for (const r of resolutions) {
    const inIndex = r.entries.filter((e) => positioned.includes(e));
    for (const e of r.entries.filter((x) => !positioned.includes(x))) {
      if (!items.some((it) => it.text === link(e))) items.push({ key: e.pdf.page, text: link(e) });
    }
    if (inIndex.length) {
      intervals.push([positioned.indexOf(inIndex[0]!), positioned.indexOf(inIndex.at(-1)!)]);
    }
  }
  intervals.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const iv of intervals) {
    const last = merged.at(-1);
    if (last && iv[0] <= last[1] + 1) last[1] = Math.max(last[1], iv[1]);
    else merged.push([...iv]);
  }
  for (const [i, j] of merged) {
    const a = positioned[i]!;
    const b = positioned[j]!;
    if (i === j || isDescendant(b, a)) items.push({ key: pos(a), text: link(a) });
    else if (j === i + 1)
      items.push({ key: pos(a), text: link(a) }, { key: pos(b), text: link(b) });
    else items.push({ key: pos(a), text: `desde ${link(a)} hasta ${link(b)}` });
  }
  items.sort((x, y) => x.key - y.key);
  return joinList(items.map((it) => it.text));
}

const PAGE_LIST = String.raw`\d+(?:[–-]\d+)?(?:(?:,\s*|\s+y\s+|\s+e\s+)\d+(?:[–-]\d+)?)*`;
const REF_RE = new RegExp(
  String.raw`(?<art>\b(?:en|de|a|desde|hasta)\s+las?\s+|\blas?\s+(?=pp?\.))?(?<cap>\b[Cc]ap\.\s*\d+,\s*)?\b(?<pp>pp?)\.\s?(?<list>${PAGE_LIST})(?!\d)`,
  "g",
);
const QUOTE_RE = /[«“]([^»”]{8,})[»”]/g;
// "Mateo 7:17", "1 Juan 2:6", "Salmo 19:14": only book, chapter and first verse.
const BIBLE_RE = /\b(?:[123] )?[A-ZÁÉÍÓÚ][a-záéíóúñ]+ \d+:\d+/g;

function spans(list: string): [number, number][] {
  return list
    .split(/,\s*|\s+y\s+|\s+e\s+/)
    .filter(Boolean)
    .map((s) => {
      const [x, y] = s.split(/[–-]/).map(Number);
      return [x!, y ?? x!];
    });
}

/** Index entries whose title matches a quoted heading, preferring the chapter in context. */
function byTitle(title: string, chapter?: number): Entry | undefined {
  const n = norm(title);
  const matches = index.filter((e) => norm(e.title) === n || norm(e.ref) === n);
  return (
    matches.find((e) => e.chapter === chapter) ?? (matches.length === 1 ? matches[0] : undefined)
  );
}

type Report = { converted: number; ambiguous: string[]; unresolved: string[] };

/**
 * The answer guide quotes the book («…») for almost every question. Those
 * quotes, located in the PDF text, tell which side of a mid-page heading the
 * cited passage is on.
 */
function answerQuotes(guide: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let code: string | undefined;
  for (const line of guide.split("\n")) {
    const h = line.match(/^#{2,4} (C\d+-[\w-]+)?/);
    if (h) code = h[1];
    if (!code) continue;
    const quotes = [...line.matchAll(QUOTE_RE)].map((q) => q[1]!);
    if (quotes.length) map.set(code, [...(map.get(code) ?? []), ...quotes]);
  }
  return map;
}
const guideFile = path.join(bookDir, "original", "03_guia_de_respuestas.md");
const quotesByCode = fs.existsSync(guideFile)
  ? answerQuotes(fs.readFileSync(guideFile, "utf8"))
  : new Map();

function convertLine(
  line: string,
  chapter: number | undefined,
  report: Report,
  extra: string[] = [],
): string {
  // A section quoted right after (or before) its own page reference only needs the link.
  line = line.replace(
    new RegExp(String.raw`\b(?:[Cc]ap\.\s*\d+,\s*)?pp?\.\s?(?:${PAGE_LIST}),\s*«([^»]+)»`, "g"),
    (m, title: string) => {
      const e = byTitle(title, chapter);
      return e ? link(e) : m;
    },
  );
  line = line.replace(
    new RegExp(String.raw`«([^»]+)»\s*\(pp?\.\s?(?:${PAGE_LIST})\)`, "g"),
    (m, title: string) => {
      const e = byTitle(title, chapter);
      return e ? link(e) : m;
    },
  );

  const matches = [...line.matchAll(REF_RE)];
  if (!matches.length) return line;
  let out = "";
  let last = 0;
  matches.forEach((m, i) => {
    const startIdx = m.index!;
    const prevEnd = i > 0 ? matches[i - 1]!.index! + matches[i - 1]![0].length : 0;
    const nextStart = i + 1 < matches.length ? matches[i + 1]!.index! : line.length;
    const segment = line.slice(prevEnd, nextStart);
    const list = m.groups!.list!;
    const ss = spans(list);
    const lo = Math.min(...ss.map((s) => s[0]));
    const hi = Math.max(...ss.map((s) => s[1]));
    const bibleRefs = [...segment.matchAll(BIBLE_RE)].map((b) => b[0]);
    const hints = [...[...segment.matchAll(QUOTE_RE)].map((q) => q[1]!), ...bibleRefs, ...extra]
      .map((q) => locate(q, lo, hi))
      .filter((h): h is number => h !== undefined);
    const resolutions = ss.map(([a, b]) => resolveSpan(a, b, hints));
    if (resolutions.some((r) => !r.entries.length)) {
      report.unresolved.push(`${m[0]} ← ${line.trim().slice(0, 140)}`);
      out += line.slice(last, startIdx) + m[0];
      last = startIdx + m[0].length;
      return;
    }
    for (const r of resolutions) {
      if (r.ambiguous)
        report.ambiguous.push(`${m[0]} → ${render(r)} ← ${line.trim().slice(0, 120)}`);
    }
    const art = m.groups!.art ?? "";
    // "en la p. 27" → "en [[…]]"; a bare "la p. 27" loses its article.
    const prep = /^\s*las?\s+$/.test(art) ? "" : art.replace(/\s*\blas?\s+$/, " ");
    let text = renderAll(resolutions);
    if (prep.trim() === "en" && text.startsWith("desde ")) {
      text = text.replace(/^desde (.+) hasta (.+)$/, "entre $1 y $2");
      out += line.slice(last, startIdx) + text;
    } else {
      if (prep && text.startsWith("desde ")) report.ambiguous.push(`(redacción) ${prep}${text}`);
      out += line.slice(last, startIdx) + prep + text;
    }
    last = startIdx + m[0].length;
    report.converted++;
  });
  return out + line.slice(last);
}

/** Quoted section titles in the lines that locate reading (not in quotations of the author). */
const LOCATOR_LINE =
  /^(\*\*Lectura:\*\*|\*\*Antes de avanzar:\*\*|- C\d+-[\w-]+ →|- \*\*Referencia:\*\*|Comprueba en|Dónde comprobar)/;

function linkQuotedSections(line: string, chapter: number | undefined): string {
  if (!LOCATOR_LINE.test(line.trimStart())) return line;
  return line.replace(/«([^»]+)»/g, (m, title: string) => {
    const e = byTitle(title, chapter);
    return e && e.kind === "section" ? link(e) : m;
  });
}

function convertFile(name: string) {
  const src = fs.readFileSync(path.join(bookDir, "original", name), "utf8");
  const report: Report = { converted: 0, ambiguous: [], unresolved: [] };
  let chapter: number | undefined;
  let entryCode: string | undefined;
  const out = src.split("\n").map((line) => {
    const h = line.match(/^#{2,3} Capítulo (\d+)\b/);
    if (h) chapter = Number(h[1]);
    if (
      /^# (Antes de empezar|PRIMERA PARTE)/.test(line) ||
      /^## Prefacio e Introducción/.test(line)
    ) {
      chapter = undefined;
    }
    // Headings name what they cover; their page ranges just go.
    if (line.startsWith("#")) {
      const heading = line.match(/^#{2,4} (C\d+-[\w-]+)?/);
      if (heading) entryCode = heading[1];
      return line.replace(/\s*\(pp?\.\s?[\d–-]+\)/g, "");
    }
    const code = line.match(/^(?:- |\*\*)(C\d+-[\w-]+)(?: →|\*\*)/)?.[1] ?? entryCode;
    const extra = code ? (quotesByCode.get(code) ?? []) : [];
    let next = line;
    if (chapter && /^\*\*Lectura:\*\* pp?\.\s?[\d–-]+,\s*/.test(next)) {
      next = next.replace(/^(\*\*Lectura:\*\* )pp?\.\s?[\d–-]+,\s*/, `$1Capítulo ${chapter}, `);
    }
    next = convertLine(next, chapter, report, extra);
    return linkQuotedSections(next, chapter);
  });
  fs.mkdirSync(path.join(bookDir, "source"), { recursive: true });
  fs.writeFileSync(path.join(bookDir, "source", name), out.join("\n"));
  console.log(`\n## ${name}: ${report.converted} referencias convertidas`);
  console.log(
    `   ambiguas (sección que empieza a mitad de página, sin cita que lo resuelva): ${report.ambiguous.length}`,
  );
  for (const a of report.ambiguous) console.log(`   ~ ${a}`);
  console.log(`   sin resolver: ${report.unresolved.length}`);
  for (const u of report.unresolved) console.log(`   ! ${u}`);
}

for (const f of values.files.split(",")) convertFile(f.trim());
