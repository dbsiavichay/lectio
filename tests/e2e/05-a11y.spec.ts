import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { BOOK, login, open } from "./helpers";

const PAGES = [
  "/",
  "/libro",
  `/libro/${BOOK}/capitulo/1`,
  `/libro/${BOOK}/sesion/s1.1?paso=3`,
  "/repasos",
  "/compromisos",
  "/mas",
  "/ajustes",
];

test("main screens have no serious accessibility violations", async ({ page }, info) => {
  await login(page, info);
  for (const path of PAGES) {
    await open(page, path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.flatMap((v) =>
        v.nodes.map((n) => `${path}: ${v.id} → ${n.target.join(" ")} ${n.any[0]?.message ?? ""}`),
      ),
    ).toEqual([]);
  }
});
