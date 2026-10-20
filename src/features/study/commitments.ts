import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { commitments } from "@/db/schema";

export type Commitment = typeof commitments.$inferSelect;

export const COMMITMENT_FIELDS = [
  "teaching",
  "behavior",
  "action",
  "situation",
  "dueOn",
  "measure",
  "learned",
] as const;
export type CommitmentField = (typeof COMMITMENT_FIELDS)[number];
export type CommitmentDraft = Partial<Record<CommitmentField, string>>;

export const CHECK_STATUSES = ["pending", "done", "partial", "not_done"] as const;

export function getCommitment(
  userId: string,
  slug: string,
  unitId: string,
): Commitment | undefined {
  return db()
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.userId, userId),
        eq(commitments.bookSlug, slug),
        eq(commitments.unitId, unitId),
      ),
    )
    .get();
}

export function listCommitments(userId: string, slug: string): Commitment[] {
  return db()
    .select()
    .from(commitments)
    .where(and(eq(commitments.userId, userId), eq(commitments.bookSlug, slug)))
    .orderBy(asc(commitments.createdAt))
    .all();
}

export function saveCommitment(
  userId: string,
  slug: string,
  unitId: string,
  draft: CommitmentDraft,
) {
  const set: Partial<Commitment> = {};
  for (const field of COMMITMENT_FIELDS) {
    const value = draft[field];
    if (value === undefined) continue;
    if (field === "dueOn") set.dueOn = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    else set[field] = value.slice(0, 2_000);
  }
  db()
    .insert(commitments)
    .values({ id: randomUUID(), userId, bookSlug: slug, unitId, ...set })
    .onConflictDoUpdate({
      target: [commitments.userId, commitments.bookSlug, commitments.unitId],
      set: { ...set, updatedAt: new Date() },
    })
    .run();
}

export function checkIn(
  userId: string,
  slug: string,
  unitId: string,
  input: { status: Commitment["status"]; observed: string; keepAsHabit: boolean },
) {
  db()
    .update(commitments)
    .set({
      status: input.status,
      observed: input.observed.slice(0, 2_000),
      keepAsHabit: input.keepAsHabit,
      checkedAt: input.status === "pending" ? null : new Date(),
    })
    .where(
      and(
        eq(commitments.userId, userId),
        eq(commitments.bookSlug, slug),
        eq(commitments.unitId, unitId),
      ),
    )
    .run();
}
