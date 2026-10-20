import { expect, type Page, type TestInfo } from "@playwright/test";
import Database from "better-sqlite3";

export const PASSWORD = "contraseña-de-prueba";
export const BOOK = "libro-ejemplo";

export const username = (info: TestInfo) => `e2e-${info.project.name}`;

export async function login(page: Page, info: TestInfo) {
  await page.goto("/entrar");
  await page.getByLabel("Usuario").fill(username(info));
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/");
}

/** Direct access to the test database (same file the server uses). */
export function testDb() {
  return new Database("test-results/e2e/lectio.db");
}

/** Makes the user's sessions look as if the last password check was hours ago. */
export function ageVerification(info: TestInfo) {
  const db = testDb();
  db.prepare(
    "update auth_sessions set verified_at = ? where user_id = (select id from users where username = ?)",
  ).run(Date.now() - 3 * 3_600_000, username(info));
  db.close();
}
