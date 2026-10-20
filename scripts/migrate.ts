import { openDb, runMigrations } from "../src/db/open";
import { env } from "../src/lib/env";

const db = openDb(env.DATABASE_PATH);
runMigrations(db, env.MIGRATIONS_DIR);
console.log(`Migraciones aplicadas en ${env.DATABASE_PATH}`);
