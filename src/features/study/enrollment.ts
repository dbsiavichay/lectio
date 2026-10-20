import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { Book } from "@/content/schema";
import { db } from "@/db/client";
import { enrollments, users } from "@/db/schema";
import { WEEKDAYS, type Weekday } from "@/lib/schedule";

export type Enrollment = {
  id: string;
  bookSlug: string;
  startedOn: string;
  studyDays: Weekday[];
  restDays: Weekday[];
  status: "active" | "paused" | "finished";
};

const parseDays = (json: string): Weekday[] =>
  (JSON.parse(json) as string[]).filter((d): d is Weekday =>
    (WEEKDAYS as readonly string[]).includes(d),
  );

function toEnrollment(row: typeof enrollments.$inferSelect): Enrollment {
  return {
    id: row.id,
    bookSlug: row.bookSlug,
    startedOn: row.startedOn,
    studyDays: parseDays(row.studyDays),
    restDays: parseDays(row.restDays),
    status: row.status,
  };
}

export function getEnrollment(userId: string, slug: string): Enrollment | null {
  const row = db()
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.bookSlug, slug)))
    .get();
  return row ? toEnrollment(row) : null;
}

export function listEnrollments(userId: string): Enrollment[] {
  return db()
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
    .all()
    .map(toEnrollment);
}

export function enroll(
  userId: string,
  book: Book,
  input: { startedOn: string; studyDays: Weekday[]; restDays: Weekday[] },
): Enrollment {
  const values = {
    startedOn: input.startedOn,
    studyDays: JSON.stringify(input.studyDays),
    restDays: JSON.stringify(input.restDays),
    status: "active" as const,
  };
  db()
    .insert(enrollments)
    .values({ id: randomUUID(), userId, bookSlug: book.slug, ...values })
    .onConflictDoUpdate({ target: [enrollments.userId, enrollments.bookSlug], set: values })
    .run();
  setCurrentBook(userId, book.slug);
  return getEnrollment(userId, book.slug)!;
}

export function setCurrentBook(userId: string, slug: string) {
  db().update(users).set({ currentBook: slug }).where(eq(users.id, userId)).run();
}

/** The book the tabs open: the last one used, or the only enrollment. */
export function currentBookSlug(userId: string): string | null {
  const row = db()
    .select({ currentBook: users.currentBook })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (row?.currentBook && getEnrollment(userId, row.currentBook)) return row.currentBook;
  return listEnrollments(userId)[0]?.bookSlug ?? null;
}
