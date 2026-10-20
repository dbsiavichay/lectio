import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db/client";
import { authChallenges, passkeys, users } from "@/db/schema";
import { env } from "@/lib/env";

import { randomToken } from "./tokens";

const RP_NAME = "Lectio";
const CHALLENGE_COOKIE = env.secureCookies ? "__Host-lectio_challenge" : "lectio_challenge";
const CHALLENGE_TTL_MS = 5 * 60_000;

type Kind = "register" | "login" | "reauth";

async function saveChallenge(kind: Kind, challenge: string, userId: string | null) {
  const id = randomToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  db().delete(authChallenges).where(lt(authChallenges.expiresAt, new Date())).run();
  db().insert(authChallenges).values({ id, challenge, kind, userId, expiresAt }).run();
  (await cookies()).set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

/** The pending challenge of this browser for that ceremony; it can be used once. */
async function takeChallenge(kind: Kind) {
  const store = await cookies();
  const id = store.get(CHALLENGE_COOKIE)?.value;
  store.delete(CHALLENGE_COOKIE);
  if (!id) return null;
  const row = db().select().from(authChallenges).where(eq(authChallenges.id, id)).get();
  db().delete(authChallenges).where(eq(authChallenges.id, id)).run();
  if (!row || row.kind !== kind || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

const parseTransports = (json: string) => JSON.parse(json) as string[];

export async function registrationOptions(
  userId: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const user = db().select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error("Usuario inexistente");
  const existing = db().select().from(passkeys).where(eq(passkeys.userId, userId)).all();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: env.rpId,
    userName: user.username,
    userDisplayName: user.displayName,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.id,
      transports: parseTransports(p.transports),
    })),
    // A discoverable credential lets the user sign in without typing the username.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await saveChallenge("register", options.challenge, userId);
  return options;
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  name: string,
): Promise<boolean> {
  const pending = await takeChallenge("register");
  if (!pending || pending.userId !== userId) return false;
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: env.APP_URL,
    expectedRPID: env.rpId,
    requireUserVerification: false,
  }).catch(() => null);
  if (!result?.verified) return false;
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  db()
    .insert(passkeys)
    .values({
      id: credential.id,
      userId,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: JSON.stringify(credential.transports ?? []),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: name.trim().slice(0, 60) || "Mi dispositivo",
    })
    .run();
  return true;
}

/**
 * Options to sign in with any passkey of this site (no username: the browser
 * offers the user's discoverable credentials), or to re-check a known user.
 */
export async function authenticationOptions(
  kind: "login" | "reauth",
  userId: string | null = null,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const allow = userId
    ? db()
        .select()
        .from(passkeys)
        .where(eq(passkeys.userId, userId))
        .all()
        .map((p) => ({ id: p.id, transports: parseTransports(p.transports) }))
    : [];
  const options = await generateAuthenticationOptions({
    rpID: env.rpId,
    allowCredentials: allow,
    userVerification: "preferred",
  });
  await saveChallenge(kind, options.challenge, userId);
  return options;
}

/** The id of the user the passkey belongs to, when the assertion is valid. */
export async function verifyAuthentication(
  kind: "login" | "reauth",
  response: AuthenticationResponseJSON,
): Promise<string | null> {
  const pending = await takeChallenge(kind);
  if (!pending) return null;
  const passkey = db().select().from(passkeys).where(eq(passkeys.id, response.id)).get();
  if (!passkey) return null;
  if (pending.userId && pending.userId !== passkey.userId) return null;
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: env.APP_URL,
    expectedRPID: env.rpId,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: parseTransports(passkey.transports),
    },
    requireUserVerification: false,
  }).catch(() => null);
  if (!result?.verified) return null;
  db()
    .update(passkeys)
    .set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() })
    .where(and(eq(passkeys.id, passkey.id), eq(passkeys.userId, passkey.userId)))
    .run();
  return passkey.userId;
}
