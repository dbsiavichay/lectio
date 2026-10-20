import "server-only";

import { and, eq, lt, ne } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";

import { db } from "@/db/client";
import { authSessions, users } from "@/db/schema";
import { env } from "@/lib/env";

import { randomToken, sha256 } from "./tokens";
import type { CurrentUser } from "./types";

/** `__Host-` pins the cookie to this origin over HTTPS; plain HTTP (local dev, e2e) can't use it. */
export const SESSION_COOKIE = env.secureCookies ? "__Host-lectio_session" : "lectio_session";

const DAY = 86_400_000;
export const SESSION_DAYS = 30;
/** How long a password or passkey check counts as recent for sensitive actions. */
export const RECENT_VERIFICATION_MS = 10 * 60_000;

export type SessionRecord = { id: string; userId: string; expiresAt: Date; verifiedAt: Date };
export type Auth = { session: SessionRecord; user: CurrentUser };

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: env.secureCookies,
  sameSite: "lax" as const,
  path: "/",
  expires,
});

/** Signs the user in on this device. Only the token's hash is stored. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_DAYS * DAY);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  db()
    .insert(authSessions)
    .values({ id: sha256(token), userId, expiresAt, verifiedAt: new Date(now), userAgent })
    .run();
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  db()
    .delete(authSessions)
    .where(and(eq(authSessions.userId, userId), lt(authSessions.expiresAt, new Date(now))))
    .run();
}

export async function readSession(): Promise<Auth | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Expiry is checked against the clock: this read happens per request, never in a prerender.
  await connection();
  const row = db()
    .select({
      session: {
        id: authSessions.id,
        userId: authSessions.userId,
        expiresAt: authSessions.expiresAt,
        verifiedAt: authSessions.verifiedAt,
      },
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        color: users.color,
        timezone: users.timezone,
      },
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, sha256(token)))
    .get();
  if (!row || row.session.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

/**
 * Keeps an active user signed in: a session used again after a day gets its
 * 30 days back. Only Server Actions and Route Handlers may set cookies.
 */
export async function touchSession(session: SessionRecord): Promise<void> {
  const now = Date.now();
  if (session.expiresAt.getTime() - now > (SESSION_DAYS - 1) * DAY) return;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  const expiresAt = new Date(now + SESSION_DAYS * DAY);
  db().update(authSessions).set({ expiresAt }).where(eq(authSessions.id, session.id)).run();
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export function markVerified(sessionId: string): void {
  db()
    .update(authSessions)
    .set({ verifiedAt: new Date() })
    .where(eq(authSessions.id, sessionId))
    .run();
}

export const isRecentlyVerified = (session: SessionRecord) =>
  Date.now() - session.verifiedAt.getTime() < RECENT_VERIFICATION_MS;

/** Private chapters stay open for an hour after a check: long enough for a session. */
export const PRIVATE_UNLOCK_MS = 60 * 60_000;
export const isPrivateUnlocked = (session: SessionRecord) =>
  Date.now() - session.verifiedAt.getTime() < PRIVATE_UNLOCK_MS;

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token)
    db()
      .delete(authSessions)
      .where(eq(authSessions.id, sha256(token)))
      .run();
  store.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere else, e.g. after a password change. */
export function revokeOtherSessions(userId: string, keepSessionId: string): void {
  db()
    .delete(authSessions)
    .where(and(eq(authSessions.userId, userId), ne(authSessions.id, keepSessionId)))
    .run();
}
