import { expect, test, type Page } from "@playwright/test";
import { assertHealthyPage, loginAs, visitAndAssertHealthy } from "./helpers";

test.describe("RBAC smoke coverage", () => {
  test("platform owner can access admin", async ({ page }) => {
    await loginAs(page, "owner");
    await visitAndAssertHealthy(page, "/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("household cannot access admin", async ({ page }) => {
    await loginAs(page, "household");
    await assertBlockedFromAdmin(page);
  });

  test("chef cannot access admin", async ({ page }) => {
    await loginAs(page, "chef");
    await assertBlockedFromAdmin(page);
  });

  test("restaurant cannot access admin", async ({ page }) => {
    await loginAs(page, "restaurant");
    await assertBlockedFromAdmin(page);
  });

  test("home catering cannot access admin", async ({ page }) => {
    await loginAs(page, "catering");
    await assertBlockedFromAdmin(page);
  });

  test("seller roles cannot access each other workspace routes", async ({ page }) => {
    await loginAs(page, "chef");
    const response = await page.goto("/restaurant/orders");
    await page.waitForLoadState("networkidle");
    await assertHealthyPage(page);
    expect(response?.status()).not.toBe(500);
    await expect(page.locator("body")).toContainText(/restaurant only|seller workspace only|coming soon/i);
    await expect(page).not.toHaveURL(/\/admin(\/|$)/);
  });

  test("restaurant cannot access home catering orders", async ({ page }) => {
    await loginAs(page, "restaurant");
    const response = await page.goto("/catering/orders");
    await page.waitForLoadState("networkidle");
    await assertHealthyPage(page);
    expect(response?.status()).not.toBe(500);
    await expect(page.locator("body")).toContainText(/home catering only|coming soon/i);
  });

  test("household cannot access seller order dashboards", async ({ page }) => {
    await loginAs(page, "household");
    const response = await page.goto("/restaurant/orders");
    await page.waitForLoadState("networkidle");
    await assertHealthyPage(page);
    expect(response?.status()).not.toBe(500);
    await expect(page.locator("body")).toContainText(/restaurant only|seller workspace only|coming soon/i);
  });
});

async function assertBlockedFromAdmin(page: Page) {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await assertHealthyPage(page);
  await expect(page).not.toHaveURL(/\/admin$/);
}
