"use server";

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";

import { db } from "@/db/client";
import { passkeys, users } from "@/db/schema";
import { authorizeAction } from "@/lib/auth/dal";
import { verifyPassword } from "@/lib/auth/password";
import { authenticationOptions, verifyAuthentication } from "@/lib/auth/passkeys";
import { markVerified } from "@/lib/auth/session";
import { loginThrottle } from "@/lib/auth/throttle";

/** Confirms the signed-in user again (private chapters, exports, password changes). */
export async function reauthWithPassword(
  password: string,
): Promise<{ ok: true } | { error: string }> {
  const { user, session } = await authorizeAction();
  const key = `reauth:${user.id}`;
  if (loginThrottle.lockedFor(key)) return { error: "Demasiados intentos. Espera unos minutos." };
  const row = db()
    .select({ hash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  if (!row || !(await verifyPassword(row.hash, password.slice(0, 200)))) {
    loginThrottle.fail(key);
    return { error: "Contraseña incorrecta." };
  }
  loginThrottle.succeed(key);
  markVerified(session.id);
  refresh();
  return { ok: true };
}

export async function hasPasskeys(): Promise<boolean> {
  const { user } = await authorizeAction();
  return Boolean(
    db().select({ id: passkeys.id }).from(passkeys).where(eq(passkeys.userId, user.id)).get(),
  );
}

export async function reauthPasskeyOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { user } = await authorizeAction();
  return authenticationOptions("reauth", user.id);
}

export async function reauthWithPasskey(
  response: AuthenticationResponseJSON,
): Promise<{ ok: true } | { error: string }> {
  const { user, session } = await authorizeAction();
  const userId = await verifyAuthentication("reauth", response);
  if (userId !== user.id) return { error: "No se pudo verificar la passkey." };
  markVerified(session.id);
  refresh();
  return { ok: true };
}
