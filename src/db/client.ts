import { env } from "@/lib/env";

import { openDb, type Db } from "./open";

// One connection per server process, kept across dev hot reloads.
const globalForDb = globalThis as unknown as { __lectioDb?: Db };

/** The app's database. Opened on first use, so `next build` never touches it. */
export function db(): Db {
  globalForDb.__lectioDb ??= openDb(env.DATABASE_PATH);
  return globalForDb.__lectioDb;
}
