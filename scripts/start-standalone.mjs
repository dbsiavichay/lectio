// Runs the production server the way the Docker image does: the standalone
// output plus the static assets copied next to it (`next build` leaves them
// out on purpose, so a CDN or the image can serve them).
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const server = path.join(standalone, "server.js");

if (!existsSync(server)) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(standalone, "public"), {
    recursive: true,
  });
}

// The standalone server changes into its own directory: relative paths would
// point inside .next/standalone, so they are resolved from the project first.
const absolute = (value, fallback) => path.resolve(root, value || fallback);

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_PATH: absolute(process.env.DATABASE_PATH, "data/lectio.db"),
    MIGRATIONS_DIR: absolute(process.env.MIGRATIONS_DIR, "src/db/migrations"),
    PORT: process.env.PORT ?? "3000",
    // Some shells export HOSTNAME as the machine name; bind to loopback unless asked.
    HOSTNAME: process.env.HOSTNAME_BIND ?? "127.0.0.1",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
