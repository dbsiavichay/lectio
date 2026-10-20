"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";

import { parseBook, type ImportReport } from "@/content/parser";
import { manifestSchema, sectionEntrySchema } from "@/content/schema";
import { storeBook } from "@/content/store";
import { db } from "@/db/client";
import { authSessions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { createUser, setPassword } from "@/lib/users";

type Result = { ok: true } | { ok: false; error: string };

export async function createUserAction(input: {
  username: string;
  displayName: string;
  password: string;
  admin: boolean;
}): Promise<Result> {
  await requireAdmin();
  try {
    await createUser(db(), { ...input, role: input.admin ? "admin" : "member" });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo crear" };
  }
  refresh();
  return { ok: true };
}

/** A new password from the administrator signs the user out everywhere. */
export async function resetPasswordAction(userId: string, password: string): Promise<Result> {
  await requireAdmin();
  try {
    await setPassword(db(), userId, password);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Contraseña inválida" };
  }
  db().delete(authSessions).where(eq(authSessions.userId, userId)).run();
  return { ok: true };
}

export async function deleteUserAction(userId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (admin.id === userId) return { ok: false, error: "No puedes eliminar tu propia cuenta." };
  db().delete(users).where(eq(users.id, userId)).run();
  refresh();
  return { ok: true };
}

export type ImportResult = {
  ok: boolean;
  report?: ImportReport;
  error?: string;
  imported?: { title: string; version: number; changed: boolean };
};

/**
 * Validates (and, unless it's a dry run, stores) a book uploaded as its
 * package files: lectio.book.json, the section index and the Markdown files.
 */
export async function importBookAction(formData: FormData, dryRun: boolean): Promise<ImportResult> {
  const admin = await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.some((f) => f.size > 5_000_000))
    return { ok: false, error: "Un archivo supera los 5 MB." };
  const byName = new Map<string, string>();
  for (const f of files) byName.set(f.name, await f.text());

  const manifestText = byName.get("lectio.book.json");
  if (!manifestText) return { ok: false, error: "Falta lectio.book.json." };
  let manifest;
  try {
    manifest = manifestSchema.parse(JSON.parse(manifestText));
  } catch {
    return { ok: false, error: "lectio.book.json no es válido." };
  }
  const base = (p: string) => p.split("/").at(-1)!;
  const read = (path: string) => byName.get(base(path));
  const missing = Object.values(manifest.files).filter((p) => !read(p));
  if (missing.length)
    return { ok: false, error: `Faltan archivos: ${missing.map(base).join(", ")}` };

  let sections;
  try {
    sections = z
      .object({ entries: z.array(sectionEntrySchema.loose()) })
      .parse(JSON.parse(read(manifest.files.sections)!)).entries;
  } catch {
    return { ok: false, error: "El índice de secciones no es válido." };
  }
  const { book, report } = parseBook({
    manifest,
    sections,
    method: read(manifest.files.method)!,
    notebook: read(manifest.files.notebook)!,
    answers: read(manifest.files.answers)!,
    reviews: read(manifest.files.reviews)!,
  });
  if (!book || dryRun) return { ok: Boolean(book), report };
  const stored = storeBook(db(), book, admin.id);
  refresh();
  return { ok: true, report, imported: { title: book.title, ...stored } };
}
