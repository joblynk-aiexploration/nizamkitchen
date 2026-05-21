import { expect, test } from "@playwright/test";
import { assertHealthyPage, loginAs, logout, visitAndAssertHealthy } from "./helpers";

test.describe("critical button and optional configuration smoke coverage", () => {
  test("login and logout buttons work through the real auth flow", async ({ page }) => {
    await loginAs(page, "household");
    await logout(page);
    await assertHealthyPage(page);
  });

  test("platform owner can view key admin pages and attempt feature flag creation", async ({ page }) => {
    await loginAs(page, "owner");
    await visitAndAssertHealthy(page, "/admin/users");
    await visitAndAssertHealthy(page, "/admin/billing");
    await visitAndAssertHealthy(page, "/admin/storage");
    await visitAndAssertHealthy(page, "/admin/verifications");

    await page.goto("/admin/feature-flags");
    await page.waitForLoadState("networkidle");
    await assertHealthyPage(page);

    const createFlagButton = page.getByRole("button", { name: /create flag/i });
    if ((await createFlagButton.count()) > 0) {
      const flagKey = `e2e_smoke_${Date.now()}`;
      const keyField = page.getByPlaceholder("Flag key").or(page.getByLabel(/flag key/i));
      const displayNameField = page.getByPlaceholder("Display name").or(page.getByLabel(/display name/i));
      const descriptionField = page.getByPlaceholder("Description").or(page.getByLabel(/description/i));

      if ((await keyField.count()) > 0) {
        await keyField.first().fill(flagKey);
      }
      if ((await displayNameField.count()) > 0) {
        await displayNameField.first().fill("E2E Smoke Flag");
      }
      if ((await descriptionField.count()) > 0) {
        await descriptionField.first().fill("Created by Playwright smoke test.");
      }

      await createFlagButton.first().click();
      await page.waitForLoadState("networkidle");
      await assertHealthyPage(page);

      const row = page.locator("tr", { hasText: flagKey });
      if (await row.count() > 0) {
        const enableButton = row.getByRole("button", { name: /enable/i });
        if (await enableButton.count() > 0) {
          await enableButton.first().click();
          await page.waitForLoadState("networkidle");
          await assertHealthyPage(page);
        }
      }
    }
  });

  test("household can view recipe/planning/grocery pages and optional support ticket flow", async ({ page }) => {
    await loginAs(page, "household");
    await visitAndAssertHealthy(page, "/recipes");
    await page
      .getByRole("link", { name: /open|view|recipe/i })
      .first()
      .click({ timeout: 10_000 })
      .catch(async () => {
        await visitAndAssertHealthy(page, "/recipes");
      });
    await assertHealthyPage(page);
    await visitAndAssertHealthy(page, "/meal-plans");
    await visitAndAssertHealthy(page, "/grocery-lists");

    await page.goto("/support/new");
    const supportFormHeading = page.getByRole("heading", { name: /support|ticket/i });
    if (await supportFormHeading.count() > 0) {
      const title = `E2E support ticket ${Date.now()}`;
      const titleField = page.getByLabel(/title/i);
      const descriptionField = page.getByLabel(/description/i);

      if (await titleField.count() > 0) {
        await titleField.first().fill(title);
      }
      if (await descriptionField.count() > 0) {
        await descriptionField
          .first()
          .fill("This ticket was created by the automated end-to-end smoke suite.");
      }

      const submitButton = page.getByRole("button", { name: /submit/i });
      if (await submitButton.count() > 0) {
        await submitButton.first().click();
        await page.waitForLoadState("networkidle");
      }

      await assertHealthyPage(page);
      if (await titleField.count() > 0) {
        await expect(page.locator("body")).toContainText(title);
      }
    } else {
      await assertHealthyPage(page);
    }
  });

  test("optional integration pages show safe setup states instead of crashing", async ({ page }) => {
    await loginAs(page, "owner");
    for (const route of [
      "/admin/restaurant-fallback",
      "/admin/youtube-discovery",
      "/admin/payments/gateways",
      "/admin/storage",
      "/admin/system",
      "/admin/support",
    ]) {
      await visitAndAssertHealthy(page, route);
      await expect(page.locator("body")).not.toContainText(
        /sk_live|sk_test|PAYPAL_CLIENT_SECRET|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID/,
      );
    }
  });
});
