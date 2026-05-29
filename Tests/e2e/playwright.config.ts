import { defineConfig, devices } from "@playwright/test";

/**
 * Frontend end-to-end config.
 *
 * The app must be running before these tests start:
 *  - Locally: `cd deployment && docker compose up` (serves the UI on :3000 and the API
 *    on :8000), then `cd Tests/e2e && npm install && npm run test:e2e`.
 *  - In CI: the workflow boots the backend and the Next.js server, waits for both, then
 *    runs this suite.
 *
 * Override the target with E2E_BASE_URL.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
