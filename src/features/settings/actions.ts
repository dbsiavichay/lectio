"use server";

import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";

import { db } from "@/db/client";
import { passkeys, users } from "@/db/schema";
import { authorizeAction } from "@/lib/auth/dal";
import { verifyPassword } from "@/lib/auth/password";
import { registrationOptions, verifyRegistration } from "@/lib/auth/passkeys";
import { markVerified, revokeOtherSessions } from "@/lib/auth/session";
import { loginThrottle } from "@/lib/auth/throttle";
import { setPassword } from "@/lib/users";

type Result = { ok: true } | { ok: false; error: string };

export async function updateTimezoneAction(timezone: string): Promise<Result> {
  const { user } = await authorizeAction();
  try {
    new Intl.DateTimeFormat("es", { timeZone: timezone });
  } catch {
    return { ok: false, error: "Zona horaria desconocida" };
  }
  db().update(users).set({ timezone }).where(eq(users.id, user.id)).run();
  refresh();
  return { ok: true };
}

export async function passkeyRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { user } = await authorizeAction();
  return registrationOptions(user.id);
}

export async function registerPasskeyAction(
  response: RegistrationResponseJSON,
  name: string,
): Promise<Result> {
  const { user, session } = await authorizeAction();
  const ok = await verifyRegistration(user.id, response, name);
  if (!ok) return { ok: false, error: "No se pudo registrar la passkey." };
  markVerified(session.id);
  refresh();
  return { ok: true };
}

export async function deletePasskeyAction(id: string): Promise<Result> {
  const { user } = await authorizeAction();
  db()
    .delete(passkeys)
    .where(and(eq(passkeys.id, id), eq(passkeys.userId, user.id)))
    .run();
  refresh();
  return { ok: true };
}

/** Changing the password signs out every other device. */
export async function changePasswordAction(current: string, next: string): Promise<Result> {
  const { user, session } = await authorizeAction();
  const key = `reauth:${user.id}`;
  if (loginThrottle.lockedFor(key))
    return { ok: false, error: "Demasiados intentos. Espera unos minutos." };
  const row = db()
    .select({ hash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  if (!row || !(await verifyPassword(row.hash, current.slice(0, 200)))) {
    loginThrottle.fail(key);
    return { ok: false, error: "La contraseña actual no es correcta." };
  }
  try {
    await setPassword(db(), user.id, next);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Contraseña inválida" };
  }
  loginThrottle.succeed(key);
  revokeOtherSessions(user.id, session.id);
  markVerified(session.id);
  return { ok: true };
}
