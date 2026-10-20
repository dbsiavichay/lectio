import { z } from "zod";

/**
 * Runtime configuration, read by the server when it starts (every page is
 * dynamic: it depends on who is signed in). A malformed value fails at boot.
 */
const envSchema = z.object({
  /** Public origin, without a trailing slash. Passkeys are bound to it. */
  APP_URL: z
    .url({ protocol: /^https?$/ })
    .transform((url) => url.replace(/\/+$/, ""))
    .default("http://localhost:3000"),
  /** WebAuthn relying party ID; the APP_URL host when unset. */
  RP_ID: z.string().min(1).optional(),
  DATABASE_PATH: z.string().min(1).default("data/lectio.db"),
  MIGRATIONS_DIR: z.string().min(1).default("src/db/migrations"),
  /** Commit the image was built from; `dev` outside CI. */
  BUILD_SHA: z
    .string()
    .regex(/^([0-9a-f]{7,40}|dev)$/)
    .default("dev"),
});

export type Env = z.infer<typeof envSchema> & { rpId: string; secureCookies: boolean };

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Empty strings (an unset compose variable) count as "not provided".
  const present = (value: string | undefined) => (value === "" ? undefined : value);
  const parsed = envSchema.parse({
    APP_URL: present(source.APP_URL),
    RP_ID: present(source.RP_ID),
    DATABASE_PATH: present(source.DATABASE_PATH),
    MIGRATIONS_DIR: present(source.MIGRATIONS_DIR),
    BUILD_SHA: present(source.BUILD_SHA),
  });
  return {
    ...parsed,
    rpId: parsed.RP_ID ?? new URL(parsed.APP_URL).hostname,
    secureCookies: parsed.APP_URL.startsWith("https://"),
  };
}

export const env = parseEnv(process.env);
