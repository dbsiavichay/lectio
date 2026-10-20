import { expect, test } from "@playwright/test";

import { BOOK, ageVerification, login, PASSWORD } from "./helpers";

test("a private chapter asks to confirm identity again", async ({ page }, info) => {
  await login(page, info);
  ageVerification(info);
  await page.goto(`/libro/${BOOK}/capitulo/2`);
  await expect(page.getByRole("heading", { name: "Capítulo 2 es privado" })).toBeVisible();
  await expect(page.getByText("Distracción y desánimo")).toBeHidden();
  await page.getByLabel(/contraseña/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Distracción y desánimo")).toBeVisible();
});
