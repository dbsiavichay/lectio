import { expect, test, type Page } from "@playwright/test";

import { BOOK, login, open, resetStudy } from "./helpers";

test.describe.configure({ mode: "serial" });

async function next(page: Page, name: RegExp | string) {
  await page.getByRole("button", { name }).click();
}

test.beforeAll(async ({}, info) => {
  resetStudy(info);
});

test.beforeEach(async ({ page }, info) => {
  await login(page, info);
});

test("starts the example book from the library", async ({ page }) => {
  await open(page, "/libros");
  const card = page.getByRole("listitem").filter({ hasText: "El Hábito de Estudiar" });
  await card.getByRole("button", { name: "Empezar este libro" }).click();
  await expect(page.getByText(/terminarás las 3 sesiones/)).toBeVisible();
  await page.getByRole("button", { name: "Empezar", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Leer no es aprender" })).toBeVisible();
});

test("a session walks through its steps and keeps the golden rule", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("link", { name: /Empezar sesión/ }).click();
  await expect(page.getByRole("heading", { name: "Leer no es aprender" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Cap\. 1 · Leer no es aprender/ }).first(),
  ).toBeVisible();

  await next(page, /Empezar: Paso 1/);
  await page.getByLabel(/Notas breves/).fill("Releer da una falsa sensación de dominio.");
  await next(page, /Paso 2 · Recuperación activa/);

  // Recall happens with the book closed.
  await expect(page.getByRole("heading", { name: "Cierra el libro" })).toBeVisible();
  await page.getByRole("button", { name: "Ya lo cerré" }).click();
  await page
    .getByRole("textbox")
    .first()
    .fill("Reconocer es identificar algo al verlo; recordar es traerlo sin verlo.");
  await expect(page.getByText("Guardado")).toBeVisible();

  await next(page, /Paso 3 · Verificación/);
  const guides = page.getByRole("button", { name: /Ver guía de respuesta/ });
  await expect(guides.nth(0)).toBeEnabled();
  await expect(guides.nth(1)).toBeDisabled(); // C1-S1-P2 has no answer yet
  await guides.nth(0).click();
  await expect(
    page.getByText(
      "reconocer es identificar algo al verlo; recordar es traerlo a la mente sin verlo.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Acerté" }).click();

  await next(page, /Paso 4 · Autoexamen/);
  await next(page, /Paso 5 · Aplicación/);
  await page.getByRole("button", { name: "Usar esta idea" }).first().click();
  await expect(page.getByLabel("Acción específica que realizaré")).toHaveValue(
    "Antes de releer, escribe de memoria lo que recuerdas.",
  );

  await next(page, "Ir al cierre");
  await expect(page.getByRole("button", { name: "Elige tu autoevaluación" })).toBeDisabled();
  await page.getByRole("button", { name: /Lo comprendo parcialmente/ }).click();
  await page.getByRole("button", { name: "Terminar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Refuerza antes de avanzar" })).toBeVisible();
});

test("a session rated 2 waits to be reinforced, then the next one follows", async ({ page }) => {
  await open(page, "/");
  await expect(page.getByText("Sesión 1.1: Leer no es aprender")).toBeVisible();
  await page.getByRole("button", { name: "Ya releí" }).click();
  await expect(page.getByText("Sesión 1.1: Leer no es aprender")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Recordar y repasar" })).toBeVisible();
  await expect(page.getByText("Antes de releer, escribe de memoria")).toBeVisible();
});

test("finishing a chapter schedules its spaced reviews", async ({ page }) => {
  await open(page, `/libro/${BOOK}/sesion/s1.2?paso=5`);
  await page.getByRole("button", { name: "Ir al cierre" }).click();
  await page.getByRole("button", { name: /Puedo explicarlo y aplicarlo/ }).click();
  await page.getByRole("button", { name: "Terminar sesión" }).click();
  await expect(page.getByRole("heading", { name: "¡Sesión completada!" })).toBeVisible();

  await open(page, "/repasos");
  await page.getByRole("tab", { name: "Próximos" }).click();
  for (const title of [
    "Ficha día +1 y evaluación final",
    "Ficha día +3",
    "Ficha día +7",
    "Ficha día +14",
  ]) {
    await expect(page.getByText(`Capítulo 1 · ${title}`)).toBeVisible();
  }
  await expect(page.getByText("mañana")).toBeVisible();
});

test("the day +3 review needs a fresh answer before showing the guide", async ({ page }) => {
  await open(page, `/libro/${BOOK}/repaso/c1-d3`);
  const card = page.getByRole("article").filter({ hasText: "C1-S1-P1" });
  // The guide was opened in the session, but here it waits for a new answer.
  await expect(card.getByRole("button", { name: /Ver guía de respuesta/ })).toBeDisabled();
  await card.getByRole("textbox").fill("Reconocer no es recordar.");
  await card.getByRole("button", { name: /Ver guía de respuesta/ }).click();
  await expect(card.getByText(/Una respuesta satisfactoria incluye/i)).toBeVisible();
  await page.getByRole("button", { name: "Marcar repaso como hecho" }).click();
  await expect(page.getByRole("button", { name: /Hecho · deshacer/ })).toBeVisible();
});

test("the chapter evaluation compares with the guide at the end", async ({ page }) => {
  await open(page, `/libro/${BOOK}/sesion/ef1`);
  await expect(page.getByRole("button", { name: /Ver guía/ })).toHaveCount(0);
  await page
    .getByRole("textbox")
    .first()
    .fill("Porque releer produce reconocimiento y no recuerdo.");
  await page.getByRole("button", { name: /Comparar con la guía/ }).click();
  await page.getByRole("button", { name: /Ver guía de respuesta/ }).click();
  await expect(page.getByText("porque releer produce reconocimiento, no recuerdo.")).toBeVisible();
  await page.getByRole("button", { name: "Terminar evaluación" }).click();
  await expect(page.getByRole("heading", { name: "Evaluación terminada" })).toBeVisible();
});

test("commitments can be checked in and kept as habits", async ({ page }) => {
  await open(page, "/compromisos");
  await page.getByRole("button", { name: /Antes de releer, escribe de memoria/ }).click();
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByLabel("Qué observé").fill("Recordé más de lo que esperaba.");
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: /Hábitos/ })).toBeVisible();
});

test("a reference chip says where to look and remembers the page of my copy", async ({ page }) => {
  await open(page, `/libro/${BOOK}/capitulo/1`);
  await page.getByRole("button", { name: /Cap\. 1 · Repasar a tiempo/ }).click();
  await expect(page.getByText("Busca en tu libro")).toBeVisible();
  await expect(page.getByText("Viene después de")).toBeVisible();
  await page.getByPlaceholder("Página").fill("37");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByRole("button", { name: /Repasar a tiempo · p\. 37/ })).toBeVisible();
});

test("keeps what was typed before the page finished loading", async ({ page, browserName }) => {
  // WebKit keeps streamed content hidden until scripts run, so there is no
  // window to type in before hydration; Chromium shows it right away.
  test.skip(browserName === "webkit", "Streamed content stays hidden until scripts run");
  // Hold the JavaScript back: the server-rendered field is usable before React is.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  // Only the scripts: held stylesheets would also block parsing the HTML.
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    await held;
    await route.continue();
  });
  // The HTML streams in while its scripts wait (DOMContentLoaded waits for them too).
  await page.goto(`/libro/${BOOK}/sesion/s1.1?paso=4`, { waitUntil: "commit" });
  const field = page.getByRole("textbox").first();
  await expect(field).toBeVisible();
  await field.fill("Escrito antes de que cargara la página.");
  release();
  await expect(page.getByText("Guardado")).toBeVisible();
  await open(page, `/libro/${BOOK}/sesion/s1.1?paso=4`);
  await expect(page.getByRole("textbox").first()).toHaveValue(
    "Escrito antes de que cargara la página.",
  );
});
