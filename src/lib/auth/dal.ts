import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { readSession, touchSession, type Auth } from "./session";
import type { CurrentUser } from "./types";

/**
 * The Data Access Layer's single source of identity: every page, action and
 * route reads the user from here, so the check can't be forgotten.
 * Memoized per request.
 */
export const getAuth = cache(readSession);

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getAuth())?.user ?? null;
}

export async function requireAuth(): Promise<Auth> {
  const auth = await getAuth();
  if (!auth) redirect("/entrar");
  return auth;
}

export async function requireUser(): Promise<CurrentUser> {
  return (await requireAuth()).user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** For Server Actions: authorizes the caller and keeps the session alive. */
export async function authorizeAction(): Promise<Auth> {
  const auth = await requireAuth();
  await touchSession(auth.session);
  return auth;
}
