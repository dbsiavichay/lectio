import "server-only";

import { and, eq } from "drizzle-orm";

import type { BookClientData } from "@/components/book/book-context";
import type { Book } from "@/content/schema";
import { db } from "@/db/client";
import { sectionPages } from "@/db/schema";

/** What client components need to render references and scales for a book. */
export function bookClientData(userId: string, book: Book): BookClientData {
  const pages = db()
    .select({ sectionId: sectionPages.sectionId, page: sectionPages.page })
    .from(sectionPages)
    .where(and(eq(sectionPages.userId, userId), eq(sectionPages.bookSlug, book.slug)))
    .all();
  return {
    slug: book.slug,
    title: book.title,
    sections: book.sections,
    chapterTitles: Object.fromEntries(book.chapters.map((c) => [c.n, c.title])),
    pages: Object.fromEntries(pages.map((p) => [p.sectionId, p.page])),
    scale: book.method.scale,
    questionTypes: book.method.questionTypes,
  };
}
