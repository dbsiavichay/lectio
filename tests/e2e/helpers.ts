import { expect, type Page, type TestInfo } from "@playwright/test";
import Database from "better-sqlite3";

export const PASSWORD = "contraseña-de-prueba";
export const BOOK = "libro-ejemplo";

export const username = (info: TestInfo) => `e2e-${info.project.name}`;

/**
 * Navigates and waits until the page is interactive: a click or a keystroke
 * before hydration is lost (CI runners are slower than a laptop).
 */
export async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}

export async function login(page: Page, info: TestInfo) {
  await open(page, "/entrar");
  await page.getByLabel("Usuario").fill(username(info));
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/");
}

/** Direct access to the test database (same file the server uses). */
export function testDb() {
  return new Database("test-results/e2e/lectio.db");
}

/**
 * Clears what a project's account studied, so a serial group retried by
 * Playwright starts from the same state as its first attempt.
 */
export function resetStudy(info: TestInfo) {
  const db = testDb();
  const user = db.prepare("select id from users where username = ?").get(username(info)) as
    { id: string } | undefined;
  if (user) {
    for (const table of [
      "enrollments",
      "unit_progress",
      "field_values",
      "answer_checks",
      "commitments",
      "review_tasks",
      "section_pages",
    ]) {
      db.prepare(`delete from ${table} where user_id = ?`).run(user.id);
    }
  }
  db.close();
}

/** Makes the user's sessions look as if the last password check was hours ago. */
export function ageVerification(info: TestInfo) {
  const db = testDb();
  db.prepare(
    "update auth_sessions set verified_at = ? where user_id = (select id from users where username = ?)",
  ).run(Date.now() - 3 * 3_600_000, username(info));
  db.close();
}
