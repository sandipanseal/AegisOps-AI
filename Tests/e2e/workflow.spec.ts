import { test, expect } from "@playwright/test";

// The full operator journey, driven entirely through the UI.
test("open incident -> run RCA -> browse tabs -> approve runbook -> postmortem", async ({
  page,
}) => {
  await page.goto("/");

  // 1. Open an incident from the default scenario
  await page.getByRole("button", { name: /open incident/i }).click();
  await expect(page.getByText(/opened incident #/i)).toBeVisible({ timeout: 25_000 });

  // 2. Run the agentic RCA workflow (detail action)
  await page.getByRole("button", { name: /run \/ re-run rca/i }).click();

  // 3. Evidence tab auto-activates and shows collected evidence
  await expect(
    page.getByRole("heading", { name: /evidence collected by agents/i })
  ).toBeVisible({ timeout: 40_000 });

  // 4. Browse the analysis tabs
  await page.getByRole("button", { name: "agents", exact: true }).click();
  await expect(page.getByRole("heading", { name: /agent traces/i })).toBeVisible();

  await page.getByRole("button", { name: "overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: /root-cause analysis/i })).toBeVisible();

  // 5. Approve a safety-gated runbook -> incident resolves in simulation mode
  await page.getByRole("button", { name: /approve restart/i }).click();
  await expect(page.getByText(/simulation mode/i)).toBeVisible({ timeout: 25_000 });

  // 6. Generate a postmortem (action button, distinct from the lowercase tab)
  await page.getByRole("button", { name: "Postmortem", exact: true }).click();
  await expect(page.getByRole("heading", { name: /generated postmortem/i })).toBeVisible({
    timeout: 25_000,
  });
});
