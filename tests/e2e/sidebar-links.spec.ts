import { expect, test } from "@playwright/test";
import { assertHealthyPage, loginAs, visitAndAssertHealthy } from "./helpers";

test.describe("visible sidebar navigation", () => {
  test("platform owner admin sidebar links all open healthy pages", async ({ page }) => {
    test.setTimeout(120_000);

    await loginAs(page, "owner");
    await page.goto("/admin");
    await assertHealthyPage(page);

    const hrefs = await page.locator("aside a[href^=\"/admin\"]").evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute("href") ?? "").filter(Boolean))],
    );

    expect(hrefs.length).toBeGreaterThan(10);

    for (const href of hrefs) {
      expect(href, "Sidebar links must not be empty or placeholder anchors").toMatch(/^\/admin(\/|$)/);
      await visitAndAssertHealthy(page, href);
    }
  });
});
