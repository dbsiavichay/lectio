import { hash, verify } from "@node-rs/argon2";

// OWASP's argon2id baseline: 19 MiB, 2 iterations, 1 lane.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 10;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Why a new password is not acceptable, or null. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password.length > 200) return "Usa como máximo 200 caracteres.";
  if (/^(.)\1+$/.test(password)) return "Elige una contraseña menos repetitiva.";
  return null;
}

// Verifying against this when the username does not exist keeps both paths
// equally slow, so response times don't reveal which accounts exist.
let dummyHash: Promise<string> | undefined;
export function dummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword("lectio-dummy-password");
  return dummyHash.then((h) => verifyPassword(h, password)).then(() => false);
}
