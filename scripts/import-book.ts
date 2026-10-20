/**
 * Validates a book package and stores it in the database.
 *
 *   npm run import -- content/books/el-esposo-ejemplar            # import
 *   npm run import -- content/books/el-esposo-ejemplar --dry-run  # only check
 *   npm run import -- <dir> --json out.json                        # also dump the parsed book
 *
 * Inside the container: node scripts/import-book.mjs /app/data/books/<slug>
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { loadBookDir } from "../src/content/load-dir";
import { parseBook, type ImportReport } from "../src/content/parser";
import { storeBook } from "../src/content/store";
import { openDb, runMigrations } from "../src/db/open";
import { env } from "../src/lib/env";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean" }, json: { type: "string" } },
});
const dir = positionals[0];
if (!dir) {
  console.error("Uso: import-book <carpeta-del-libro> [--dry-run] [--json archivo]");
  process.exit(1);
}

const { book, report } = parseBook(loadBookDir(dir));
printReport(report);
if (!book) {
  console.error("\nNo se importó: corrige los errores de arriba.");
  process.exit(1);
}
if (values.json) writeFileSync(values.json, JSON.stringify(book, null, 1));
if (values["dry-run"]) {
  console.log("\nValidación correcta (sin importar).");
  process.exit(0);
}
const db = openDb(env.DATABASE_PATH);
runMigrations(db, env.MIGRATIONS_DIR);
const { version } = storeBook(db, book, null);
console.log(
  `\nImportado «${book.title}» (${book.slug}), versión ${version}, en ${env.DATABASE_PATH}.`,
);

function printReport(r: ImportReport) {
  const s = r.stats;
  console.log(
    `Partes ${s.parts} · capítulos ${s.chapters} · sesiones ${s.sessions} · evaluaciones ${s.evaluations}\n` +
      `Preguntas ${s.questions} · respuestas ${s.answers} (pendientes ${s.pendingAnswers}) · ` +
      `fichas ${s.reviewCards} · repasos de bloque ${s.blockReviews} · referencias ${s.references}`,
  );
  if (r.warnings.length)
    console.log(`\nAvisos (${r.warnings.length}):\n  - ${r.warnings.join("\n  - ")}`);
  if (r.errors.length)
    console.log(`\nErrores (${r.errors.length}):\n  - ${r.errors.join("\n  - ")}`);
}
