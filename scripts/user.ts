/**
 * Manages accounts. There is no public sign-up: the administrator creates them.
 *
 *   npm run user -- create <usuario> "<Nombre>" [--admin]
 *   npm run user -- password <usuario>
 *   npm run user -- list
 *   npm run user -- delete <usuario>
 *
 * Inside the container: node scripts/user.mjs create denis "Denis" --admin
 * The password is asked without echo; LECTIO_PASSWORD supplies it in scripts.
 */
import { eq } from "drizzle-orm";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { openDb, runMigrations } from "../src/db/open";
import { users } from "../src/db/schema";
import { env } from "../src/lib/env";
import { createUser, findUserByUsername, listUsers, setPassword } from "../src/lib/users";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { admin: { type: "boolean" } },
});
const [command, username, displayName] = positionals;

const db = openDb(env.DATABASE_PATH);
runMigrations(db, env.MIGRATIONS_DIR);

async function askPassword(prompt: string): Promise<string> {
  if (process.env.LECTIO_PASSWORD) return process.env.LECTIO_PASSWORD;
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const ask = (q: string) =>
    new Promise<string>((resolve) => {
      process.stdout.write(q);
      muted = true;
      rl.question("", (answer) => {
        muted = false;
        process.stdout.write("\n");
        resolve(answer);
      });
    });
  const first = await ask(prompt);
  const second = await ask("Repítela: ");
  rl.close();
  if (first !== second) throw new Error("Las contraseñas no coinciden.");
  return first;
}

async function main() {
  switch (command) {
    case "create": {
      if (!username || !displayName)
        throw new Error('Uso: user create <usuario> "<Nombre>" [--admin]');
      const password = await askPassword(`Contraseña para ${username}: `);
      await createUser(db, {
        username,
        displayName,
        password,
        role: values.admin ? "admin" : "member",
      });
      console.log(`Usuario «${username}» creado${values.admin ? " como administrador" : ""}.`);
      break;
    }
    case "password": {
      const user = username && findUserByUsername(db, username);
      if (!user) throw new Error(`No existe el usuario «${username ?? ""}».`);
      await setPassword(db, user.id, await askPassword(`Nueva contraseña para ${user.username}: `));
      console.log("Contraseña actualizada.");
      break;
    }
    case "list":
      for (const u of listUsers(db))
        console.log(`${u.username.padEnd(20)} ${u.role.padEnd(7)} ${u.displayName}`);
      break;
    case "delete": {
      const user = username && findUserByUsername(db, username);
      if (!user) throw new Error(`No existe el usuario «${username ?? ""}».`);
      db.delete(users).where(eq(users.id, user.id)).run();
      console.log(`Usuario «${user.username}» eliminado, con todo su estudio.`);
      break;
    }
    default:
      throw new Error("Comandos: create, password, list, delete.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
