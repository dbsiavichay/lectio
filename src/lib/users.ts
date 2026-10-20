import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import type { Db } from "../db/open";
import { users } from "../db/schema";
import { hashPassword, passwordProblem } from "./auth/password";

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
export const AVATAR_COLORS = [
  "teal",
  "indigo",
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "slate",
] as const;

export type NewUser = {
  username: string;
  displayName: string;
  password: string;
  role?: "admin" | "member";
};

/** Creates an account. Throws a message meant for the person creating it. */
export async function createUser(db: Db, input: NewUser): Promise<string> {
  const username = input.username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      "El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.",
    );
  }
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Falta el nombre para mostrar.");
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  if (db.select({ id: users.id }).from(users).where(eq(users.username, username)).get()) {
    throw new Error(`Ya existe el usuario «${username}».`);
  }
  const count = db.select({ id: users.id }).from(users).all().length;
  const id = randomUUID();
  db.insert(users)
    .values({
      id,
      username,
      displayName,
      passwordHash: await hashPassword(input.password),
      role: input.role ?? "member",
      color: AVATAR_COLORS[count % AVATAR_COLORS.length],
    })
    .run();
  return id;
}

export async function setPassword(db: Db, userId: string, password: string): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  db.update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, userId))
    .run();
}

export function findUserByUsername(db: Db, username: string) {
  return db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).get();
}

export function listUsers(db: Db) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt))
    .all();
}
