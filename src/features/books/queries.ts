import "server-only";

import { asc, eq } from "drizzle-orm";

import { bookSchema, type Book } from "@/content/schema";
import { db } from "@/db/client";
import { books } from "@/db/schema";

// Parsed books by slug and version: the JSON is validated once per import.
const cache = new Map<string, { version: number; book: Book }>();

export function getBook(slug: string): Book | null {
  const current = db()
    .select({ version: books.version })
    .from(books)
    .where(eq(books.slug, slug))
    .get();
  if (!current) return null;
  const hit = cache.get(slug);
  if (hit?.version === current.version) return hit.book;
  const row = db()
    .select({ version: books.version, content: books.content })
    .from(books)
    .where(eq(books.slug, slug))
    .get();
  if (!row) return null;
  const book = bookSchema.parse(row.content);
  cache.set(slug, { version: row.version, book });
  return book;
}

export function listBooks() {
  return db()
    .select({
      slug: books.slug,
      title: books.title,
      author: books.author,
      version: books.version,
      importedAt: books.importedAt,
    })
    .from(books)
    .orderBy(asc(books.title))
    .all();
}
