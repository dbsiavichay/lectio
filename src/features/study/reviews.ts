import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { chapterOf } from "@/content/navigation";
import type { Book } from "@/content/schema";
import { db } from "@/db/client";
import { reviewTasks } from "@/db/schema";

export type ReviewTask = typeof reviewTasks.$inferSelect;

export const REVIEW_MINUTES: Record<ReviewTask["kind"], number> = {
  d1: 25,
  d3: 10,
  d7: 5,
  d14: 10,
  block: 30,
  final: 45,
};

const DAY_TITLES: Record<"d1" | "d3" | "d7" | "d14", string> = {
  d1: "Ficha día +1 y evaluación final",
  d3: "Ficha día +3: preguntas esenciales",
  d7: "Ficha día +7: explicar en voz alta",
  d14: "Ficha día +14: enseñanza y aplicación",
};

export function reviewTitle(
  book: Book,
  task: Pick<ReviewTask, "kind" | "ref">,
): { title: string; subtitle: string } {
  if (task.kind === "block") {
    return {
      title: `Repaso de bloque ${task.ref}`,
      subtitle: book.reviews.blocks[String(task.ref)]?.title ?? "",
    };
  }
  if (task.kind === "final") return { title: "Evaluación final del libro", subtitle: book.title };
  const ch = chapterOf(book, task.ref);
  return { title: `Capítulo ${task.ref} · ${DAY_TITLES[task.kind]}`, subtitle: ch?.title ?? "" };
}

/** URL segment of a review: "c3-d7", "bloque-2", "final". */
export const reviewSlug = (task: Pick<ReviewTask, "kind" | "ref">) =>
  task.kind === "block"
    ? `bloque-${task.ref}`
    : task.kind === "final"
      ? "final"
      : `c${task.ref}-${task.kind}`;

export function parseReviewSlug(slug: string): Pick<ReviewTask, "kind" | "ref"> | null {
  if (slug === "final") return { kind: "final", ref: 0 };
  const block = slug.match(/^bloque-(\d+)$/);
  if (block) return { kind: "block", ref: Number(block[1]) };
  const card = slug.match(/^c(\d+)-(d1|d3|d7|d14)$/);
  if (card) return { kind: card[2] as "d1" | "d3" | "d7" | "d14", ref: Number(card[1]) };
  return null;
}

export function listReviews(userId: string, slug: string): ReviewTask[] {
  return db()
    .select()
    .from(reviewTasks)
    .where(and(eq(reviewTasks.userId, userId), eq(reviewTasks.bookSlug, slug)))
    .orderBy(asc(reviewTasks.dueOn), asc(reviewTasks.createdAt))
    .all();
}

export function pendingReviews(userId: string, slug: string): ReviewTask[] {
  return db()
    .select()
    .from(reviewTasks)
    .where(
      and(
        eq(reviewTasks.userId, userId),
        eq(reviewTasks.bookSlug, slug),
        isNull(reviewTasks.completedAt),
      ),
    )
    .orderBy(asc(reviewTasks.dueOn))
    .all();
}

export function findReview(
  userId: string,
  slug: string,
  key: Pick<ReviewTask, "kind" | "ref">,
): ReviewTask | undefined {
  return db()
    .select()
    .from(reviewTasks)
    .where(
      and(
        eq(reviewTasks.userId, userId),
        eq(reviewTasks.bookSlug, slug),
        eq(reviewTasks.kind, key.kind),
        eq(reviewTasks.ref, key.ref),
      ),
    )
    .get();
}

export function setReviewDone(userId: string, slug: string, id: string, done: boolean) {
  db()
    .update(reviewTasks)
    .set({ completedAt: done ? new Date() : null })
    .where(
      and(eq(reviewTasks.id, id), eq(reviewTasks.userId, userId), eq(reviewTasks.bookSlug, slug)),
    )
    .run();
}
