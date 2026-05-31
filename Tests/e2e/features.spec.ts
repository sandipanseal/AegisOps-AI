import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end smoke coverage for the incident-operations & reliability features:
 * lifecycle, SLA, confidence explanation, runbook risk, RCA feedback, tool-fault
 * simulation, prompt-injection scan, eval dataset, canary, and dependency graph.
 *
 * Data is seeded through the backend API (E2E_API_URL, default :8000), then each
 * page/panel is driven through the browser (E2E_BASE_URL, default :3000).
 */
const API = process.env.E2E_API_URL || "http://localhost:8000";

async function analyzedIncident(request: APIRequestContext, scenario = "payment_pool_regression") {
  const incident = await (await request.post(`${API}/incidents/from-scenario/${scenario}`)).json();
  await request.post(`${API}/incidents/${incident.id}/analyze`);
  return incident as { id: number; title: string; service_name: string };
}

test("SLA page shows fleet compliance and budgets", async ({ page, request }) => {
  await analyzedIncident(request);
  await page.goto("/sla");
  await expect(page.getByRole("heading", { name: /SLA tracking/i })).toBeVisible();
  // Policy table / stage labels are always rendered.
  await expect(page.getByText(/acknowledge/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/resolve/i).first()).toBeVisible();
});

test("dependency graph renders nodes and runs impact analysis", async ({ page }) => {
  await page.goto("/dependencies");
  await expect(page.getByRole("heading", { name: /service dependency graph/i })).toBeVisible();
  const node = page.getByRole("button", { name: /payment-service/ }).first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  await node.click();
  await expect(page.getByText(/blast radius/i).first()).toBeVisible({ timeout: 15_000 });
});

test("canary analysis returns a verdict", async ({ page }) => {
  await page.goto("/canary");
  await expect(page.getByRole("heading", { name: /canary deployment analysis/i })).toBeVisible();
  await page.getByRole("button", { name: /analyze canary/i }).click();
  await expect(page.getByText(/promote|hold|rollback/i).first()).toBeVisible({ timeout: 20_000 });
});

test("incident detail exposes lifecycle, confidence and RCA feedback", async ({ page, request }) => {
  const incident = await analyzedIncident(request, "auth_secret_rotation");
  await page.goto(`/incidents/${incident.id}`);

  // 3. AI confidence explanation
  await expect(page.getByRole("heading", { name: /why this confidence/i })).toBeVisible({ timeout: 20_000 });

  // 1. Lifecycle workflow
  await expect(page.getByRole("heading", { name: /^lifecycle$/i })).toBeVisible();

  // 5. Human RCA feedback — submit a verdict
  await expect(page.getByRole("heading", { name: /rate this rca/i })).toBeVisible();
  await page.getByRole("button", { name: "Accurate", exact: true }).click();
  await page.getByPlaceholder("Your name").fill("e2e-bot");
  await page.getByRole("button", { name: /submit feedback/i }).click();
  await expect(page.getByText(/e2e-bot/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/failed to submit/i)).toHaveCount(0);

  // 1. Lifecycle transition through the UI -> incident resolves
  await page.getByRole("button", { name: /^resolved$/i }).click();
  await expect(page.getByText(/\bresolved\b/i).first()).toBeVisible({ timeout: 15_000 });
});

test("eval dataset manager lists cases and the benchmark runs", async ({ page }) => {
  await page.goto("/evals");
  await expect(page.getByRole("heading", { name: /RCA eval dataset/i })).toBeVisible({ timeout: 15_000 });
  // Seeded builtin cases expose their scenario key in the list (unique to the rows,
  // unlike service names which also appear as <select> options in the add-case form).
  await expect(page.getByText("payment_pool_regression").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /run benchmark/i }).click();
  await expect(page.getByText(/passed/i).first()).toBeVisible({ timeout: 20_000 });
});

test("integrations exposes tool-fault simulation and prompt-injection scan", async ({ page }) => {
  await page.goto("/integrations");

  // 6. Tool failure fallback simulation
  await expect(page.getByRole("heading", { name: /tool failure simulation/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^loki$/i).first()).toBeVisible();

  // 7. Prompt-injection detection
  await expect(page.getByRole("heading", { name: /prompt-injection scan/i })).toBeVisible();
  await page.getByRole("button", { name: /scan logs/i }).click();
  await expect(page.getByText(/detection/i).first()).toBeVisible({ timeout: 15_000 });
});
