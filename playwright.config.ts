import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// localhost, not 127.0.0.1: an IP address can't be a WebAuthn relying party.
const baseURL = `http://localhost:${PORT}`;

/**
 * End-to-end tests run against the production build (`npm run build` first)
 * on a fresh database with the example book. They share that database, so
 * they run in order.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", locale: "es-EC", timezoneId: "America/Guayaquil" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] }, testIgnore: /passkeys/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    env: { PORT: String(PORT) },
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
