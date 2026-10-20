// Bundles the command-line scripts for the container, where there is no tsx:
// dist/scripts/{migrate,user,import-book,backup}.mjs. Native addons stay
// external and load from the standalone server's node_modules.
import { build } from "esbuild";

await build({
  entryPoints: [
    "scripts/migrate.ts",
    "scripts/user.ts",
    "scripts/import-book.ts",
    "scripts/backup.ts",
  ],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: "dist/scripts",
  outExtension: { ".js": ".mjs" },
  external: ["better-sqlite3", "@node-rs/argon2"],
  // Bundled CommonJS dependencies may still call require().
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "warning",
});
console.log("Scripts empaquetados en dist/scripts");
