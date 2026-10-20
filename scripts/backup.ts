/**
 * Hot backup of the database: a consistent copy while the server keeps
 * running (SQLite's online backup API), into <data>/backups, keeping 14 days.
 *
 *   npm run backup                       # local
 *   node scripts/backup.mjs              # inside the container (cron: deploy/scripts/backup.sh)
 */
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

import { env } from "../src/lib/env";

const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS ?? 14);

async function main() {
  const dir = process.env.BACKUP_DIR ?? path.join(path.dirname(env.DATABASE_PATH), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
  const target = path.join(dir, `lectio-${stamp}.db`);
  const db = new Database(env.DATABASE_PATH, { readonly: true, fileMustExist: true });
  await db.backup(target);
  db.close();
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (/^lectio-.*\.db$/.test(name) && statSync(file).mtimeMs < cutoff) {
      unlinkSync(file);
      removed++;
    }
  }
  console.log(
    `Respaldo: ${target} (${(statSync(target).size / 1024).toFixed(0)} KB). Eliminados por antigüedad: ${removed}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
