import "server-only";

import { notFound } from "next/navigation";

import { getBook } from "@/features/books/queries";
import { requireUser } from "@/lib/auth/dal";

import { currentBookSlug, getEnrollment } from "./enrollment";

/** The signed-in user and the book the tabs point at (null when none is started). */
export async function currentStudy() {
  const user = await requireUser();
  const slug = currentBookSlug(user.id);
  const book = slug ? getBook(slug) : null;
  const enrollment = book ? getEnrollment(user.id, book.slug) : null;
  return { user, book, enrollment };
}

/** A specific book; 404 when it doesn't exist. */
export async function studyFor(slug: string) {
  const user = await requireUser();
  const book = getBook(slug);
  if (!book) notFound();
  return { user, book, enrollment: getEnrollment(user.id, book.slug) };
}

export function greeting(timezone: string, now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(now),
  );
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}
