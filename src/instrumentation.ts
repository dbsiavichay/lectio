/**
 * Runs once when the server starts, before it takes requests: the database
 * schema is brought up to date, so a new image never serves an old schema.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ db }, { runMigrations }, { env }] = await Promise.all([
    import("./db/client"),
    import("./db/open"),
    import("./lib/env"),
  ]);
  runMigrations(db(), env.MIGRATIONS_DIR);
}
