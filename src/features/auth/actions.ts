"use server";

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { dummyVerify, verifyPassword } from "@/lib/auth/password";
import { authenticationOptions, verifyAuthentication } from "@/lib/auth/passkeys";
import { createSession, destroySession } from "@/lib/auth/session";
import { loginThrottle } from "@/lib/auth/throttle";
import { findUserByUsername } from "@/lib/users";

export type LoginState = { error?: string };

/** Only same-site paths: an attacker can't bounce a login to another site. */
function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

async function clientIp(): Promise<string> {
  const h = await headers();
  // Caddy, the only way in, sets X-Forwarded-For.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function lockMessage(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
}

export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 64);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const keys = [`ip:${await clientIp()}`, `user:${username}`];

  const locked = loginThrottle.lockedFor(...keys);
  if (locked) return { error: lockMessage(locked) };
  if (!username || !password) return { error: "Escribe tu usuario y tu contraseña." };

  const user = findUserByUsername(db(), username);
  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : await dummyVerify(password);
  if (!user || !valid) {
    loginThrottle.fail(...keys);
    return { error: "Usuario o contraseña incorrectos." };
  }
  loginThrottle.succeed(...keys);
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function passkeyLoginOptions(): Promise<
  PublicKeyCredentialRequestOptionsJSON | { error: string }
> {
  const locked = loginThrottle.lockedFor(`ip:${await clientIp()}`);
  if (locked) return { error: lockMessage(locked) };
  return authenticationOptions("login");
}

export async function passkeyLogin(
  response: AuthenticationResponseJSON,
  next: string,
): Promise<{ next: string } | { error: string }> {
  const ipKey = `ip:${await clientIp()}`;
  const locked = loginThrottle.lockedFor(ipKey);
  if (locked) return { error: lockMessage(locked) };
  const userId = await verifyAuthentication("login", response);
  if (!userId) {
    loginThrottle.fail(ipKey);
    return { error: "No se pudo verificar la passkey. Prueba otra vez o entra con tu contraseña." };
  }
  loginThrottle.succeed(ipKey);
  await createSession(userId);
  return { next: safeNext(next) };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/entrar");
}
