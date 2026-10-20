"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { isAllowedKey } from "@/content/navigation";
import type { Answer } from "@/content/schema";
import { getBook } from "@/features/books/queries";
import { authorizeAction } from "@/lib/auth/dal";
import { WEEKDAYS, todayIn } from "@/lib/schedule";

import { db } from "@/db/client";
import { sectionPages } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { CHECK_STATUSES, checkIn, saveCommitment } from "./commitments";
import { enroll, getEnrollment, setCurrentBook } from "./enrollment";
import { MAX_FIELD_LENGTH, getFields, recordGrade, recordReveal, saveFields } from "./fields";
import { completeUnit, markReinforced, setCurrentStep } from "./progress";
import { findReview, parseReviewSlug, setReviewDone } from "./reviews";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const slugSchema = z.string().regex(/^[a-z0-9-]+$/);

async function context(slug: string) {
  const auth = await authorizeAction();
  const book = getBook(slugSchema.parse(slug));
  if (!book) throw new Error("Libro inexistente");
  return { ...auth, book };
}

const entriesSchema = z
  .array(z.tuple([z.string().max(200), z.string().max(MAX_FIELD_LENGTH)]))
  .max(100);

/** Autosave: the notebook sends what changed every few hundred milliseconds. */
export async function saveFieldsAction(slug: string, entries: [string, string][]): Promise<Result> {
  const { user, book } = await context(slug);
  const parsed = entriesSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const unknown = parsed.data.find(([key]) => !isAllowedKey(book, key));
  if (unknown) return { ok: false, error: `Campo desconocido: ${unknown[0]}` };
  saveFields(user.id, book.slug, parsed.data);
  return { ok: true };
}

export async function setStepAction(slug: string, unitId: string, step: number): Promise<Result> {
  const { user, book } = await context(slug);
  const unit = book.units[unitId];
  if (
    unit?.kind !== "session" ||
    !Number.isInteger(step) ||
    step < 1 ||
    step > unit.steps.length + 1
  ) {
    return { ok: false, error: "Paso inválido" };
  }
  setCurrentStep(user.id, book.slug, unitId, step);
  return { ok: true };
}

export async function completeUnitAction(
  slug: string,
  unitId: string,
  rating: number | null,
): Promise<Result<{ status: string }>> {
  const { user, book } = await context(slug);
  if (!book.units[unitId]) return { ok: false, error: "Unidad inexistente" };
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 4))
    return { ok: false, error: "Escala inválida" };
  const enrollment = getEnrollment(user.id, book.slug);
  if (!enrollment) return { ok: false, error: "Primero empieza el libro" };
  const status = completeUnit(
    user.id,
    book,
    unitId,
    rating,
    todayIn(user.timezone),
    enrollment.restDays,
  );
  refresh();
  return { ok: true, data: { status } };
}

export async function markReinforcedAction(slug: string, unitId: string): Promise<Result> {
  const { user, book } = await context(slug);
  markReinforced(user.id, book.slug, unitId);
  refresh();
  return { ok: true };
}

/**
 * The guide entry of a question, only once the user's own answer is saved:
 * the method's golden rule, enforced on the server. `fieldKey` is the field
 * that holds the answer (the code itself, or a review's re-answer).
 */
export async function revealAnswerAction(
  slug: string,
  code: string,
  fieldKey?: string,
): Promise<Result<Answer>> {
  const { user, book } = await context(slug);
  const answer = book.answers[code];
  if (!answer) return { ok: false, error: "Esta pregunta no tiene respuesta en la guía" };
  const key = fieldKey ?? code;
  if (key !== code && !(key.endsWith(`:${code}`) && isAllowedKey(book, key)))
    return { ok: false, error: "Campo inválido" };
  const written = getFields(user.id, book.slug, [key])[key]?.trim();
  if (!written) return { ok: false, error: "Escribe primero tu respuesta" };
  recordReveal(user.id, book.slug, code);
  return { ok: true, data: answer };
}

export async function gradeAnswerAction(
  slug: string,
  code: string,
  grade: "correct" | "partial" | "missed" | null,
): Promise<Result> {
  const { user, book } = await context(slug);
  if (!book.answers[code]) return { ok: false, error: "Pregunta inválida" };
  recordGrade(
    user.id,
    book.slug,
    code,
    z.enum(["correct", "partial", "missed"]).nullable().parse(grade),
  );
  return { ok: true };
}

const commitmentSchema = z
  .object({
    teaching: z.string(),
    behavior: z.string(),
    action: z.string(),
    situation: z.string(),
    dueOn: z.string(),
    measure: z.string(),
    learned: z.string(),
  })
  .partial();

export async function saveCommitmentAction(
  slug: string,
  unitId: string,
  draft: z.infer<typeof commitmentSchema>,
): Promise<Result> {
  const { user, book } = await context(slug);
  if (!book.units[unitId]) return { ok: false, error: "Unidad inexistente" };
  saveCommitment(user.id, book.slug, unitId, commitmentSchema.parse(draft));
  return { ok: true };
}

export async function checkInAction(
  slug: string,
  unitId: string,
  input: { status: string; observed: string; keepAsHabit: boolean },
): Promise<Result> {
  const { user, book } = await context(slug);
  const parsed = z
    .object({
      status: z.enum(CHECK_STATUSES),
      observed: z.string().max(2_000),
      keepAsHabit: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  checkIn(user.id, book.slug, unitId, parsed.data);
  refresh();
  return { ok: true };
}

export async function setReviewDoneAction(
  slug: string,
  review: string,
  done: boolean,
): Promise<Result> {
  const { user, book } = await context(slug);
  const key = parseReviewSlug(review);
  const task = key && findReview(user.id, book.slug, key);
  if (!task) return { ok: false, error: "Repaso inexistente" };
  setReviewDone(user.id, book.slug, task.id, done);
  refresh();
  return { ok: true };
}

const daysSchema = z.array(z.enum(WEEKDAYS)).max(7);

export async function enrollAction(
  slug: string,
  input: { studyDays: string[]; restDays: string[] },
): Promise<Result> {
  const { user, book } = await context(slug);
  const studyDays = daysSchema.safeParse(input.studyDays);
  const restDays = daysSchema.safeParse(input.restDays);
  if (!studyDays.success || !restDays.success || studyDays.data.length === 0) {
    return { ok: false, error: "Elige al menos un día de estudio" };
  }
  const existing = getEnrollment(user.id, book.slug);
  enroll(user.id, book, {
    startedOn: existing?.startedOn ?? todayIn(user.timezone),
    studyDays: studyDays.data,
    restDays: restDays.data.filter((d) => !studyDays.data.includes(d)),
  });
  refresh();
  return { ok: true };
}

export async function openBookAction(slug: string): Promise<Result> {
  const { user, book } = await context(slug);
  if (getEnrollment(user.id, book.slug)) setCurrentBook(user.id, book.slug);
  return { ok: true };
}

/** "Mis páginas": where a section starts in the user's own printed copy. */
export async function saveSectionPageAction(
  slug: string,
  sectionId: string,
  page: number | null,
): Promise<Result> {
  const { user, book } = await context(slug);
  if (!book.sections.some((s) => s.id === sectionId))
    return { ok: false, error: "Sección inexistente" };
  const where = and(
    eq(sectionPages.userId, user.id),
    eq(sectionPages.bookSlug, book.slug),
    eq(sectionPages.sectionId, sectionId),
  );
  if (page === null) {
    db().delete(sectionPages).where(where).run();
  } else {
    if (!Number.isInteger(page) || page < 1 || page > 5_000)
      return { ok: false, error: "Página inválida" };
    db()
      .insert(sectionPages)
      .values({ userId: user.id, bookSlug: book.slug, sectionId, page })
      .onConflictDoUpdate({
        target: [sectionPages.userId, sectionPages.bookSlug, sectionPages.sectionId],
        set: { page },
      })
      .run();
  }
  return { ok: true };
}
