import { expect, test } from "@playwright/test";
import { assertHealthyPage } from "./helpers";

const expectedFooterLinks = [
  "/features",
  "/marketplace",
  "/pricing",
  "/for-households",
  "/marketplace/chefs",
  "/marketplace/caterers",
  "/marketplace/restaurants",
  "/marketplace/dishes",
  "/about",
  "/contact",
  "/help",
  "/faq",
  "/terms",
  "/privacy",
  "/cookie-policy",
  "/legal/seller-agreement",
  "/legal/food-safety",
];

test.describe("public footer links", () => {
  test("homepage footer exposes only working internal links", async ({ page }) => {
    await page.goto("/");
    await assertHealthyPage(page);

    const footer = page.getByTestId("public-footer");
    await expect(footer).toBeVisible();

    const hrefs = await footer.locator("a[href]").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );

    expect(hrefs.sort()).toEqual([...expectedFooterLinks].sort());
    for (const href of hrefs) {
      expect(href, "Footer links must not be empty or placeholder anchors").toMatch(/^\/(?!$|#)/);
    }
  });

  test("every visible homepage footer link is clickable and opens a healthy page", async ({ page }) => {
    for (const href of expectedFooterLinks) {
      await page.goto("/");
      await assertHealthyPage(page);

      const footer = page.getByTestId("public-footer");
      await footer.scrollIntoViewIfNeeded();
      await footer.locator(`a[href="${href}"]`).click();
      await page.waitForLoadState("networkidle");

      expect(new URL(page.url()).pathname).toBe(href);
      await assertHealthyPage(page);
    }
  });
});
