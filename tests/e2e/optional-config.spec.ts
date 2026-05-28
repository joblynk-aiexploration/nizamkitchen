import { test, expect } from "@playwright/test";
import { loginAs, assertHealthyPage } from "./helpers";

test.describe("optional configuration graceful behavior", () => {
  const setupAwareRoutes = [
    "/admin/system",
    "/admin/restaurant-fallback",
    "/admin/youtube-discovery",
    "/admin/payments/configurations",
    "/admin/payments/gateways",
    "/admin/storage/configuration",
    "/admin/storage/tests",
  ];

  test("routes render safely when optional integrations are not fully configured", async ({ page }) => {
    await loginAs(page, "owner");

    for (const route of setupAwareRoutes) {
      const response = await page.goto(route);
      await page.waitForLoadState("networkidle");
      if (response?.status() === 404) {
        continue;
      }

      await assertHealthyPage(page);
      await expect(page.locator("body")).not.toContainText(
        /sk_live|sk_test|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|PAYPAL_CLIENT_SECRET/,
      );
    }
  });
});
