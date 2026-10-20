import { expect, test } from "@playwright/test";

import { login, open } from "./helpers";

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The virtual authenticator is a Chromium feature",
);

test("registers a passkey and signs in with it", async ({ page, context }, info) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await login(page, info);
  await open(page, "/ajustes");
  await page.getByLabel("Nombre del dispositivo").fill("Autenticador de prueba");
  await page.getByRole("button", { name: "Agregar passkey" }).click();
  await expect(page.getByText("Autenticador de prueba")).toBeVisible();

  await open(page, "/mas");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL("/entrar");
  await page.getByRole("button", { name: "Entrar con Face ID o huella" }).click();
  await expect(page).toHaveURL("/");
});
