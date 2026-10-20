// Starts the production build for the end-to-end tests on a fresh database:
// migrations, one admin account and the example book. Run `npm run build` first.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const port = process.env.PORT ?? "3100";
const env = {
  ...process.env,
  // Absolute: the standalone server changes into its own directory.
  DATABASE_PATH: path.resolve("test-results/e2e/lectio.db"),
  MIGRATIONS_DIR: path.resolve("src/db/migrations"),
  APP_URL: `http://localhost:${port}`,
  PORT: port,
  LECTIO_PASSWORD: "contraseña-de-prueba",
};

rmSync("test-results/e2e", { recursive: true, force: true });
const run = (...args) => {
  const r = spawnSync("npx", ["tsx", ...args], { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("scripts/migrate.ts");
// One account per Playwright project: each device starts from a clean slate.
for (const project of ["phone", "iphone", "desktop"]) {
  run("scripts/user.ts", "create", `e2e-${project}`, "Estudiante de Prueba", "--admin");
}
run("scripts/import-book.ts", "content/fixtures/libro-ejemplo");

const server = spawn(process.execPath, ["scripts/start-standalone.mjs"], {
  env: { ...env, HOSTNAME_BIND: "localhost" },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
