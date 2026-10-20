import { z } from "zod";

/**
 * The shape of an imported book. The parser builds it from the notebook's
 * Markdown and the importer validates it before storing it, so the app reads
 * a trusted structure. Every field the user can fill has a stable `key`: the
 * question code, or a path made from the unit and the field's label. Answers
 * are stored by that key, so re-importing a corrected notebook keeps them.
 *
 * Markdown strings may contain book references, `[[Cap. 1 › Sección]]`,
 * already checked against the section index.
 */

const markdown = z.string();

export const questionTypeSchema = z.enum(["A", "B", "C", "D"]);

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markdown"), md: markdown }),
  /** A callout (the notebook's blockquotes): notes, warnings, optional extras. */
  z.object({ type: z.literal("note"), md: markdown }),
  z.object({
    type: z.literal("question"),
    key: z.string(),
    code: z.string(),
    qtype: questionTypeSchema.nullable(),
    interpretation: z.boolean(),
    prompt: markdown,
    /** "Mi respuesta", "Mi reflexión personal"… */
    label: z.string(),
    lines: z.number().int().min(1),
    /** Where to check it in the book (step 3), when the session says so. */
    verify: markdown.optional(),
    /** The guide has an entry for it (A, B and final evaluation questions). */
    hasAnswer: z.boolean(),
  }),
  z.object({
    type: z.literal("text"),
    key: z.string(),
    label: markdown,
    lines: z.number().int().min(1),
  }),
  /** Numbered blanks: "Tres ideas esenciales" → three one-line fields. */
  z.object({
    type: z.literal("items"),
    key: z.string(),
    label: markdown,
    count: z.number().int().min(1),
  }),
  z.object({ type: z.literal("checklist"), key: z.string(), items: z.array(markdown) }),
  z.object({ type: z.literal("rating"), key: z.string(), label: markdown }),
  /** "☐ testimonio ☐ voluntad de Dios": a set of independent checks. */
  z.object({
    type: z.literal("checks"),
    key: z.string(),
    label: markdown,
    items: z.array(z.string()),
  }),
  /** Suggestions the user can pick to fill the commitment's action. */
  z.object({ type: z.literal("ideas"), label: markdown, items: z.array(markdown) }),
  /** The practical commitment of a session (stored in its own table). */
  z.object({ type: z.literal("commitment"), key: z.string(), learnedLabel: markdown }),
  /** Step 3's "Dónde comprobar": each question, where to check it, and its guide entry. */
  z.object({
    type: z.literal("verify"),
    items: z.array(z.object({ code: z.string(), where: markdown })),
  }),
  /** Re-answer earlier questions from memory (the day +3 review). */
  z.object({
    type: z.literal("requestion"),
    key: z.string(),
    intro: markdown,
    codes: z.array(z.string()),
  }),
  /** A spoken explanation against the clock (the day +7 review). */
  z.object({ type: z.literal("timer"), md: markdown, seconds: z.number().int().min(1) }),
  z.object({
    type: z.literal("table"),
    key: z.string(),
    columns: z.array(z.string()),
    /** One label per row; the other cells are inputs. */
    rows: z.array(z.string()),
  }),
  /** One-line fields in a list: "- Enseñanza que quiero aplicar: ____". */
  z.object({
    type: z.literal("fields"),
    key: z.string(),
    items: z.array(z.object({ key: z.string(), label: markdown })),
  }),
]);
export type Block = z.infer<typeof blockSchema>;

export const stepSchema = z.object({
  n: z.number().int(),
  title: z.string(),
  minutes: z.number().int().nullable(),
  /** Recall happens with the book closed: the reading guide is hidden. */
  closedBook: z.boolean(),
  blocks: z.array(blockSchema),
});
export type Step = z.infer<typeof stepSchema>;

export const sessionSchema = z.object({
  kind: z.literal("session"),
  /** "s1.1", "s0". */
  id: z.string(),
  chapter: z.number().int(),
  /** "1.1", "0". */
  number: z.string(),
  title: z.string(),
  minutes: z.number().int(),
  /** What to read and where (the «Lectura» line and notes before the steps). */
  intro: z.array(blockSchema),
  steps: z.array(stepSchema).min(1),
  closing: z
    .object({
      checklist: blockSchema.nullable(),
      rating: blockSchema.nullable(),
      beforeAdvancing: markdown.nullable(),
    })
    .nullable(),
  optional: z.boolean(),
});
export type Session = z.infer<typeof sessionSchema>;

export const evaluationSchema = z.object({
  kind: z.literal("evaluation"),
  /** "ef1". */
  id: z.string(),
  chapter: z.number().int(),
  title: z.string(),
  blocks: z.array(blockSchema),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const unitSchema = z.discriminatedUnion("kind", [sessionSchema, evaluationSchema]);
export type Unit = z.infer<typeof unitSchema>;

export const sectionEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(["front", "part", "chapter", "section", "appendix", "back"]),
  /** The text inside [[…]]. */
  ref: z.string(),
  title: z.string(),
  level: z.number().int(),
  chapter: z.number().int().optional(),
});
export type SectionEntry = z.infer<typeof sectionEntrySchema>;

export const chapterSchema = z.object({
  n: z.number().int(),
  title: z.string(),
  part: z.number().int(),
  intro: z.array(blockSchema),
  /** Sessions and the final evaluation, in order. */
  units: z.array(z.string()),
  private: z.boolean(),
});
export type Chapter = z.infer<typeof chapterSchema>;

export const partSchema = z.object({
  n: z.number().int(),
  title: z.string(),
  intro: z.array(blockSchema),
  chapters: z.array(z.number().int()),
});
export type Part = z.infer<typeof partSchema>;

export const answerSchema = z.object({
  code: z.string(),
  title: z.string(),
  reference: markdown.nullable(),
  textSays: markdown.nullable(),
  interpretation: markdown.nullable(),
  /** Final evaluation entries give one guiding answer instead. */
  guide: markdown.nullable(),
  satisfactory: markdown.nullable(),
  /** The entry waits for content from the printed book. */
  pending: markdown.nullable(),
  /** Any other labelled item ("Comparación con…"). */
  extra: z.array(z.object({ label: z.string(), md: markdown })),
});
export type Answer = z.infer<typeof answerSchema>;

export const reviewCardSchema = z.object({
  chapter: z.number().int(),
  d1: z.array(blockSchema),
  d3: z.array(blockSchema),
  d7: z.array(blockSchema),
  d14: z.array(blockSchema),
});
export type ReviewCard = z.infer<typeof reviewCardSchema>;

export const reviewSectionSchema = z.object({ title: z.string(), blocks: z.array(blockSchema) });

export const methodSchema = z.object({
  sessionMinutes: z.number().int(),
  reviewOffsets: z.array(z.number().int()),
  defaultStudyDays: z.array(z.string()),
  defaultRestDays: z.array(z.string()),
  dailyLoadWarningMinutes: z.number().int(),
  scale: z.record(z.string(), z.string()),
  questionTypes: z.record(z.string(), z.string()),
  /** The method guide, as Markdown. */
  guide: markdown,
});

export const bookSchema = z.object({
  formatVersion: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  subtitle: z.string().nullable(),
  author: z.string(),
  edition: z.string().nullable(),
  bible: z.string().nullable(),
  method: methodSchema,
  sections: z.array(sectionEntrySchema),
  parts: z.array(partSchema),
  chapters: z.array(chapterSchema),
  /** Chapter 0 holds the optional Session 0 (preface and introduction). */
  front: z
    .object({ title: z.string(), intro: z.array(blockSchema), units: z.array(z.string()) })
    .nullable(),
  units: z.record(z.string(), unitSchema),
  answers: z.record(z.string(), answerSchema),
  orientations: z.record(z.string(), markdown),
  reviews: z.object({
    intro: markdown,
    weekly: z.array(blockSchema),
    cards: z.record(z.string(), reviewCardSchema),
    blocks: z.record(z.string(), reviewSectionSchema),
    final: z.object({ intro: markdown, sections: z.array(reviewSectionSchema) }).nullable(),
  }),
});
export type Book = z.infer<typeof bookSchema>;

/** What the importer reads from `lectio.book.json`. */
export const manifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  subtitle: z.string().optional(),
  author: z.string(),
  edition: z.string().optional(),
  translator: z.string().optional(),
  bible: z.string().optional(),
  language: z.string().default("es"),
  files: z.object({
    sections: z.string(),
    method: z.string(),
    notebook: z.string(),
    answers: z.string(),
    reviews: z.string(),
  }),
  method: methodSchema.omit({ guide: true }),
  privateChapters: z.array(z.number().int()).default([]),
});
export type Manifest = z.infer<typeof manifestSchema>;
