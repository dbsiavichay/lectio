import { expect, test } from "@playwright/test";

import { login, username, open } from "./helpers";

test("sends visitors without a session to the sign-in page", async ({ page }) => {
  await open(page, "/compromisos");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fcompromisos/);
  await expect(page.getByRole("heading", { name: "Lectio" })).toBeVisible();
});

test("rejects a wrong password without saying which part was wrong", async ({ page }, info) => {
  await open(page, "/entrar");
  await page.getByLabel("Usuario").fill(username(info));
  await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-contraseña");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(
    "Usuario o contraseña incorrectos.",
  );
});

test("signs in, returns to the requested page and signs out", async ({ page }, info) => {
  await open(page, "/mas");
  await page.getByLabel("Usuario").fill(username(info));
  await page.getByLabel("Contraseña", { exact: true }).fill("contraseña-de-prueba");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/mas");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL("/entrar");
  await open(page, "/");
  await expect(page).toHaveURL("/entrar");
});

test("signing in again lands on Hoy", async ({ page }, info) => {
  await login(page, info);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Estudiante");
});
