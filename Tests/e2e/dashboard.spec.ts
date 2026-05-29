import { test, expect } from "@playwright/test";

test.describe("command center", () => {
  test("loads the dashboard shell, nav, metrics, and 3D topology", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /resolve production incidents/i })
    ).toBeVisible();

    // top navigation
    await expect(page.getByRole("link", { name: /incidents/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /evaluations/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /integrations/i }).first()).toBeVisible();

    // metrics row
    await expect(page.getByText("Total incidents")).toBeVisible();

    // the 3D topology canvas mounts
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("navigates between every section", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /incidents/i }).first().click();
    await expect(page).toHaveURL(/\/incidents/);
    await expect(page.getByRole("heading", { name: /all incidents/i })).toBeVisible();

    await page.getByRole("link", { name: /evaluations/i }).first().click();
    await expect(page).toHaveURL(/\/evals/);
    await expect(
      page.getByRole("heading", { name: /rca evaluation center/i })
    ).toBeVisible();

    await page.getByRole("link", { name: /integrations/i }).first().click();
    await expect(page).toHaveURL(/\/integrations/);
    await expect(page.getByRole("heading", { name: /control center/i })).toBeVisible();
  });
});
