import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Db } from "../db/open";
import { books } from "../db/schema";
import type { Book } from "./schema";

/**
 * Saves a parsed book. Re-importing the same slug replaces its content and
 * bumps the version; what users wrote is keyed by stable field keys, so it
 * stays attached to the same questions.
 */
export function storeBook(
  db: Db,
  book: Book,
  importedBy: string | null,
): { version: number; changed: boolean } {
  const json = JSON.stringify(book);
  const contentHash = createHash("sha256").update(json).digest("hex");
  const existing = db
    .select({ version: books.version, contentHash: books.contentHash })
    .from(books)
    .where(eq(books.slug, book.slug))
    .get();
  if (existing?.contentHash === contentHash) return { version: existing.version, changed: false };
  const version = (existing?.version ?? 0) + 1;
  const row = {
    title: book.title,
    author: book.author,
    version,
    contentHash,
    content: book,
    importedAt: new Date(),
    importedBy,
  };
  db.insert(books)
    .values({ slug: book.slug, ...row })
    .onConflictDoUpdate({ target: books.slug, set: row })
    .run();
  return { version, changed: true };
}
