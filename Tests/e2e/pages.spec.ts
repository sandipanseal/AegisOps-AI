import { test, expect } from "@playwright/test";

test("incidents page: fault injection gives feedback", async ({ page }) => {
  await page.goto("/incidents");
  await expect(page.getByRole("heading", { name: /all incidents/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /fault injection/i })).toBeVisible();

  await page.getByRole("button", { name: /payment-service/i }).first().click();
  await expect(page.getByText(/injecting fault|injected|failed/i)).toBeVisible({
    timeout: 15_000,
  });
});

test("evaluation center: runs a benchmark and shows a score", async ({ page }) => {
  await page.goto("/evals");
  await expect(
    page.getByRole("heading", { name: /rca evaluation center/i })
  ).toBeVisible();

  await page.getByRole("button", { name: /run benchmark/i }).click();
  await expect(page.getByText(/benchmark complete:/i)).toBeVisible({
    timeout: 20_000,
  });
});

test("integrations: model-usage returns a response payload", async ({ page }) => {
  await page.goto("/integrations");
  await expect(page.getByRole("heading", { name: /control center/i })).toBeVisible();

  await page.getByRole("button", { name: /view usage/i }).click();
  await expect(page.getByText(/total_calls/)).toBeVisible({ timeout: 15_000 });
});

test("integrations: RAG search returns results array", async ({ page }) => {
  await page.goto("/integrations");
  await page.getByRole("button", { name: /^search$/i }).click();
  await expect(page.getByText(/"results"|"query"/)).toBeVisible({ timeout: 15_000 });
});
