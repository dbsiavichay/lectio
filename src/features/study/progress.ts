import "server-only";

import { and, eq } from "drizzle-orm";

import { chapterSessions, partOfChapter } from "@/content/navigation";
import type { Book } from "@/content/schema";
import { db } from "@/db/client";
import { reviewTasks, unitProgress } from "@/db/schema";
import { addDays, chapterReviewDates, skipRestDays, type Weekday } from "@/lib/schedule";

import { randomUUID } from "node:crypto";

export type UnitProgress = typeof unitProgress.$inferSelect;

/** A unit counts as done once finished, even if it still needs reinforcing. */
export const isDone = (p: UnitProgress | undefined) =>
  p?.status === "completed" || p?.status === "needs_review";

export function getProgress(userId: string, slug: string): Map<string, UnitProgress> {
  const rows = db()
    .select()
    .from(unitProgress)
    .where(and(eq(unitProgress.userId, userId), eq(unitProgress.bookSlug, slug)))
    .all();
  return new Map(rows.map((r) => [r.unitId, r]));
}

export function getUnitProgress(
  userId: string,
  slug: string,
  unitId: string,
): UnitProgress | undefined {
  return db()
    .select()
    .from(unitProgress)
    .where(
      and(
        eq(unitProgress.userId, userId),
        eq(unitProgress.bookSlug, slug),
        eq(unitProgress.unitId, unitId),
      ),
    )
    .get();
}

export function startUnit(userId: string, slug: string, unitId: string) {
  db()
    .insert(unitProgress)
    .values({
      userId,
      bookSlug: slug,
      unitId,
      status: "in_progress",
      currentStep: 1,
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .run();
}

export function setCurrentStep(userId: string, slug: string, unitId: string, step: number) {
  startUnit(userId, slug, unitId);
  db()
    .update(unitProgress)
    .set({ currentStep: step })
    .where(
      and(
        eq(unitProgress.userId, userId),
        eq(unitProgress.bookSlug, slug),
        eq(unitProgress.unitId, unitId),
      ),
    )
    .run();
}

/**
 * Closes a session or an evaluation. A 1 or 2 on the scale leaves a session
 * to reinforce: the method asks to reread before moving on. Finishing the last
 * session of a chapter, of a part or of the book schedules its reviews.
 */
export function completeUnit(
  userId: string,
  book: Book,
  unitId: string,
  rating: number | null,
  completedOn: string,
  restDays: Weekday[],
): UnitProgress["status"] {
  const unit = book.units[unitId];
  if (!unit) throw new Error(`Unidad inexistente: ${unitId}`);
  const status =
    unit.kind === "session" && rating !== null && rating <= 2 ? "needs_review" : "completed";
  const previous = getUnitProgress(userId, book.slug, unitId);
  startUnit(userId, book.slug, unitId);
  db()
    .update(unitProgress)
    .set({
      status,
      rating,
      completedAt: previous?.completedAt ?? new Date(),
      completedOn: previous?.completedOn ?? completedOn,
    })
    .where(
      and(
        eq(unitProgress.userId, userId),
        eq(unitProgress.bookSlug, book.slug),
        eq(unitProgress.unitId, unitId),
      ),
    )
    .run();
  if (unit.kind === "session" && unit.chapter > 0)
    scheduleReviews(userId, book, unit.chapter, completedOn, restDays);
  return status;
}

/** "Ya releí": a session marked to reinforce becomes completed. */
export function markReinforced(userId: string, slug: string, unitId: string) {
  db()
    .update(unitProgress)
    .set({ status: "completed" })
    .where(
      and(
        eq(unitProgress.userId, userId),
        eq(unitProgress.bookSlug, slug),
        eq(unitProgress.unitId, unitId),
        eq(unitProgress.status, "needs_review"),
      ),
    )
    .run();
}

function insertReview(
  userId: string,
  slug: string,
  kind: (typeof reviewTasks.$inferInsert)["kind"],
  ref: number,
  dueOn: string,
) {
  db()
    .insert(reviewTasks)
    .values({ id: randomUUID(), userId, bookSlug: slug, kind, ref, dueOn })
    .onConflictDoNothing()
    .run();
}

export function scheduleReviews(
  userId: string,
  book: Book,
  chapter: number,
  completedOn: string,
  restDays: Weekday[],
) {
  const progress = getProgress(userId, book.slug);
  const chapterDone = (n: number) =>
    chapterSessions(book, n).every((s) => isDone(progress.get(s.id)));
  if (!chapterDone(chapter)) return;

  if (book.reviews.cards[String(chapter)]) {
    for (const { kind, dueOn } of chapterReviewDates(
      completedOn,
      book.method.reviewOffsets,
      restDays,
    )) {
      insertReview(userId, book.slug, kind, chapter, dueOn);
    }
  }
  const nextDay = skipRestDays(addDays(completedOn, 1), restDays);
  const part = partOfChapter(book, chapter);
  if (part && book.reviews.blocks[String(part.n)] && part.chapters.every(chapterDone)) {
    insertReview(userId, book.slug, "block", part.n, nextDay);
  }
  if (book.reviews.final && book.chapters.every((c) => chapterDone(c.n))) {
    insertReview(userId, book.slug, "final", 0, nextDay);
  }
}
