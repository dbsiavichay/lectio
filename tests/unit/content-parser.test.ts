import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadBookDir } from "@/content/load-dir";
import { allBlocks, parseBook, type BookSources } from "@/content/parser";
import type { Block, Session } from "@/content/schema";

const fixtureDir = path.resolve("content/fixtures/libro-ejemplo");
const realBookDir = path.resolve("content/books/el-esposo-ejemplar");

function parse(sources: BookSources = loadBookDir(fixtureDir)) {
  return parseBook(sources);
}

function fieldKeys(blocks: Iterable<Block>): string[] {
  const keys: string[] = [];
  for (const b of blocks) {
    if ("key" in b) keys.push(b.key);
    if (b.type === "fields") keys.push(...b.items.map((i) => i.key));
  }
  return keys;
}

describe("parseBook with the example book", () => {
  const { book, report } = parse();

  it("imports without errors and counts what it found", () => {
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.stats).toMatchObject({
      parts: 1,
      chapters: 2,
      sessions: 4,
      evaluations: 2,
      questions: 11,
      answers: 7,
      pendingAnswers: 1,
      reviewCards: 2,
      blockReviews: 1,
    });
  });

  it("builds a session from its headings", () => {
    const session = book!.units["s1.1"] as Session;
    expect(session.title).toBe("Leer no es aprender");
    expect(session.minutes).toBe(40);
    expect(session.steps.map((s) => [s.n, s.title, s.minutes, s.closedBook])).toEqual([
      [1, "Lectura comprensiva", 15, false],
      [2, "Recuperación activa", 5, true],
      [3, "Verificación y profundización", 5, false],
      [4, "Autoexamen personal", 10, false],
      [5, "Aplicación práctica", 5, false],
    ]);
    expect(session.closing?.rating).toMatchObject({ type: "rating", key: "s1.1.rating" });
    expect(session.closing?.checklist).toMatchObject({
      type: "checklist",
      items: expect.any(Array),
    });
    expect(session.closing?.beforeAdvancing).toContain("[[Cap. 1 › Leer no es aprender]]");
  });

  it("turns question paragraphs into questions that know where to check them", () => {
    const recall = (book!.units["s1.1"] as Session).steps[1]!.blocks;
    const questions = recall.filter((b) => b.type === "question");
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      code: "C1-S1-P1",
      qtype: "A",
      label: "Mi respuesta",
      lines: 2,
      hasAnswer: true,
      verify: "[[Cap. 1 › Leer no es aprender]], el ejemplo del examen.",
    });
    expect(questions[1]).toMatchObject({ code: "C1-S1-P2", interpretation: true });
  });

  it("recognises the step 5 commitment, its ideas and the step 3 fields", () => {
    const s = book!.units["s1.1"] as Session;
    expect(s.steps[4]!.blocks.map((b) => b.type)).toEqual(["ideas", "commitment"]);
    expect(s.steps[4]!.blocks[1]).toMatchObject({
      key: "s1.1",
      learnedLabel: expect.stringContaining("Qué aprendí"),
    });
    expect(s.steps[2]!.blocks.map((b) => b.type)).toEqual(["verify", "text", "text"]);
  });

  it("reads Session 0 as optional front matter", () => {
    expect(book!.front?.units).toEqual(["s0"]);
    expect(book!.units.s0).toMatchObject({
      optional: true,
      minutes: 20,
      title: "Introducción del libro",
    });
  });

  it("reads evaluations, review cards, block reviews and the final evaluation", () => {
    const ef = book!.units.ef1!;
    expect(ef.kind).toBe("evaluation");
    expect(ef.kind === "evaluation" && ef.blocks.map((b) => b.type)).toEqual([
      "markdown",
      "question",
      "items",
    ]);
    const card = book!.reviews.cards["1"]!;
    expect(card.d3[0]).toMatchObject({ type: "requestion", codes: ["C1-S1-P1", "C1-S2-P1"] });
    expect(card.d7.map((b) => b.type)).toEqual(["timer", "checks"]);
    expect(card.d7[1]).toMatchObject({ items: ["reconocer", "recordar", "intervalos"] });
    expect(book!.reviews.blocks["1"]!.blocks.map((b) => b.type)).toEqual([
      "text",
      "rating",
      "markdown",
    ]);
    expect(book!.reviews.final?.sections.map((s) => s.blocks.at(-1)?.type)).toEqual([
      "text",
      "table",
    ]);
    expect(book!.reviews.weekly.map((b) => b.type)).toEqual(["markdown", "fields"]);
  });

  it("parses the answer guide entries and orientations", () => {
    expect(book!.answers["C1-S1-P2"]).toMatchObject({
      title: "El subrayado",
      reference: "[[Cap. 1 › Leer no es aprender]].",
      interpretation: "el esfuerzo es lo que fija el recuerdo.",
    });
    expect(book!.answers["C1-EF-1"]?.guide).toContain("reconocimiento");
    expect(book!.answers["C1-S2-P1"]?.pending).toBe("completa los intervalos con tu libro.");
    expect(book!.orientations["1"]).toContain("hechos concretos");
  });

  it("marks private chapters from the manifest", () => {
    expect(book!.chapters.map((c) => [c.n, c.private])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("gives every field a unique, stable key", () => {
    const keys = fieldKeys(allBlocks(book!));
    expect(new Set(keys).size).toBe(keys.length);
    const again = fieldKeys(allBlocks(parse().book!));
    expect(again).toEqual(keys);
  });
});

describe("parseBook catches inconsistent notebooks", () => {
  const base = loadBookDir(fixtureDir);

  it("rejects a reference to a section that is not in the index", () => {
    const { book, report } = parse({
      ...base,
      notebook: base.notebook.replace("[[Cap. 1 › Repasar a tiempo]]", "[[Cap. 1 › No existe]]"),
    });
    expect(book).toBeNull();
    expect(report.errors).toContain(
      "Referencia a una sección que no está en el índice: [[Cap. 1 › No existe]]",
    );
  });

  it("rejects an answer for a question that does not exist", () => {
    const { report } = parse({
      ...base,
      answers: `${base.answers}\n\n#### C9-S9-P9 — Huérfana\n\n- **Referencia:** [[Cap. 1]].\n`,
    });
    expect(report.errors).toContain("La guía responde una pregunta que no existe: C9-S9-P9");
  });

  it("rejects duplicated question codes", () => {
    const { report } = parse({
      ...base,
      notebook: base.notebook.replace("**C1-S1-P2**", "**C1-S1-P1**"),
    });
    expect(report.errors).toContain("Código de pregunta duplicado: C1-S1-P1");
  });

  it("warns when a comprehension question has no answer", () => {
    const { report } = parse({
      ...base,
      answers: base.answers.replace(/#### C1-S1-P1[\s\S]*?(?=#### C1-S1-P2)/, ""),
    });
    expect(report.warnings).toContain("La pregunta C1-S1-P1 no tiene respuesta en la guía");
  });
});

// The real book is personal material kept out of git; this runs only where it exists.
describe.skipIf(!existsSync(realBookDir))("parseBook with El Esposo Ejemplar", () => {
  it("finds the whole notebook", () => {
    const { book, report } = parse(loadBookDir(realBookDir));
    expect(report.errors).toEqual([]);
    expect(report.stats).toMatchObject({
      parts: 4,
      chapters: 21,
      sessions: 47,
      evaluations: 21,
      questions: 431,
      answers: 292,
      reviewCards: 21,
      blockReviews: 3,
    });
    expect(book!.chapters.find((c) => c.n === 20)?.private).toBe(true);
  });
});
