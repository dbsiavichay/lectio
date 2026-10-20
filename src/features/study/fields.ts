import "server-only";

import { and, eq, inArray, like } from "drizzle-orm";

import { db } from "@/db/client";
import { answerChecks, fieldValues } from "@/db/schema";

export const MAX_FIELD_LENGTH = 20_000;

export type FieldMap = Record<string, string>;

export function getFields(userId: string, slug: string, keys: string[]): FieldMap {
  if (!keys.length) return {};
  const out: FieldMap = {};
  // SQLite caps bound parameters; read in chunks.
  for (let i = 0; i < keys.length; i += 500) {
    const rows = db()
      .select({ key: fieldValues.key, value: fieldValues.value })
      .from(fieldValues)
      .where(
        and(
          eq(fieldValues.userId, userId),
          eq(fieldValues.bookSlug, slug),
          inArray(fieldValues.key, keys.slice(i, i + 500)),
        ),
      )
      .all();
    for (const r of rows) out[r.key] = r.value;
  }
  return out;
}

export function getFieldsByPrefix(userId: string, slug: string, prefix: string): FieldMap {
  const rows = db()
    .select({ key: fieldValues.key, value: fieldValues.value })
    .from(fieldValues)
    .where(
      and(
        eq(fieldValues.userId, userId),
        eq(fieldValues.bookSlug, slug),
        like(fieldValues.key, `${prefix}%`),
      ),
    )
    .all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Upserts values; an empty string deletes the row. */
export function saveFields(userId: string, slug: string, entries: [string, string][]) {
  const conn = db();
  conn.transaction((tx) => {
    for (const [key, raw] of entries) {
      const value = raw.slice(0, MAX_FIELD_LENGTH);
      if (value === "") {
        tx.delete(fieldValues)
          .where(
            and(
              eq(fieldValues.userId, userId),
              eq(fieldValues.bookSlug, slug),
              eq(fieldValues.key, key),
            ),
          )
          .run();
        continue;
      }
      tx.insert(fieldValues)
        .values({ userId, bookSlug: slug, key, value })
        .onConflictDoUpdate({
          target: [fieldValues.userId, fieldValues.bookSlug, fieldValues.key],
          set: { value, updatedAt: new Date() },
        })
        .run();
    }
  });
}

export type AnswerCheck = { code: string; grade: "correct" | "partial" | "missed" | null };

export function getAnswerChecks(
  userId: string,
  slug: string,
  codes: string[],
): Record<string, AnswerCheck> {
  if (!codes.length) return {};
  const rows = db()
    .select({ code: answerChecks.code, grade: answerChecks.grade })
    .from(answerChecks)
    .where(
      and(
        eq(answerChecks.userId, userId),
        eq(answerChecks.bookSlug, slug),
        inArray(answerChecks.code, codes),
      ),
    )
    .all();
  return Object.fromEntries(rows.map((r) => [r.code, r]));
}

export function recordReveal(userId: string, slug: string, code: string) {
  db()
    .insert(answerChecks)
    .values({ userId, bookSlug: slug, code, revealedAt: new Date() })
    .onConflictDoNothing()
    .run();
}

export function recordGrade(
  userId: string,
  slug: string,
  code: string,
  grade: AnswerCheck["grade"],
) {
  db()
    .update(answerChecks)
    .set({ grade })
    .where(
      and(
        eq(answerChecks.userId, userId),
        eq(answerChecks.bookSlug, slug),
        eq(answerChecks.code, code),
      ),
    )
    .run();
}
