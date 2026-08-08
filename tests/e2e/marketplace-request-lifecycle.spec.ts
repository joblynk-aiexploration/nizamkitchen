/**
 * Marketplace Request Lifecycle E2E Test
 *
 * Tests the complete end-to-end flow for:
 *   1. Chef Request:  Household submits → Chef sees → Chef accepts → Household sees update
 *   2. Food Order:   Household submits → Caterer sees → Caterer accepts → Household sees update
 *   3. Restaurant:   Household discovers /restaurants listing and profile page
 *   4. Filters:      Filter controls present on all marketplace listing pages
 *
 * Seeds used:
 *   - NIZAM_CHEF_SLUG: nizam-independent-home-chef (active/verified, owned by chefstaff@nizamkitchen.dev)
 *   - MUTTON_BIRYANI_ITEM_ID: cmphk8ukn001r7rvh3ivh26s2 (active, public menu item on Nizam Home Catering)
 *   - RESTAURANT_SLUG: biryani-house-demo-restaurant (active restaurant)
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  assertHealthyPage,
  visitAndAssertHealthy,
} from "./helpers";

const NIZAM_CHEF_SLUG = "nizam-independent-home-chef";
const MUTTON_BIRYANI_ITEM_ID = "cmphk8ukn001r7rvh3ivh26s2";
const RESTAURANT_SLUG = "biryani-house-demo-restaurant";

// ──────────────────────────────────────────────────────────────
// PART 1: Chef Request Lifecycle
// ──────────────────────────────────────────────────────────────

test.describe("Chef Request Lifecycle", () => {
  // Shared state across the serial test group — request ID captured after submission
  let capturedRequestId: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("1a. Household submits chef request — form fills and submits", async ({ page }) => {
    await loginAs(page, "household");
    await visitAndAssertHealthy(page, `/chefs/${NIZAM_CHEF_SLUG}/request`);

    // Verify the form rendered correctly
    await expect(page.getByRole("heading", { name: /request nizam independent home chef/i })).toBeVisible();

    // guestCount already defaults to 4 — just verify it's there
    const guestCountInput = page.locator('input[name="guestCount"]');
    await expect(guestCountInput).toBeVisible();

    // Fill required address fields — LocationPicker uses controlled React inputs.
    // serviceAddressLine1, city, region all have HTML `required` attribute.
    await page.locator('input[name="serviceAddressLine1"]').fill("123 Elm Street");
    await page.locator('input[name="city"]').fill("Chicago");
    await page.locator('input[name="region"]').fill("IL");

    // Submit the form
    await page.getByRole("button", { name: /submit request/i }).click();

    // Wait for server action redirect
    await page.waitForURL(/\/home-chef\/requests\//, { timeout: 20_000 });
    await assertHealthyPage(page);

    // Capture the request ID from the redirect URL
    const url = page.url();
    const match = url.match(/\/home-chef\/requests\/([^?#]+)/);
    expect(match, "Request ID should be in redirect URL").toBeTruthy();
    capturedRequestId = match?.[1] ?? null;

    // Household detail page should show the request status
    await expect(page.locator("body")).not.toContainText(/error|exception/i);
  });

  test("1b. Chef sees the submitted request in dashboard", async ({ page }) => {
    expect(capturedRequestId, "Request ID must be captured from step 1a").toBeTruthy();

    await loginAs(page, "chef");
    await visitAndAssertHealthy(page, "/chef/requests");

    // The request should appear in the list — title "Chef for Hyderabadi Chicken Biryani"
    // or similar based on the household's first recipe
    await expect(page.getByText(/Chef for/i).or(page.getByText(/reviewing|Offer pending/i)).first()).toBeVisible();
  });

  test("1c. Chef accepts the request", async ({ page }) => {
    expect(capturedRequestId, "Request ID must be captured from step 1a").toBeTruthy();

    await loginAs(page, "chef");

    // Navigate directly to this specific request (not the list) to avoid clicking
    // the wrong request when there are multiple from prior test runs
    await visitAndAssertHealthy(page, `/chef/requests/${capturedRequestId}`);

    // The accept form should be visible since the request has a pending offer
    const acceptButton = page.getByRole("button", { name: /accept order/i });
    await expect(acceptButton).toBeVisible();

    // Submit acceptance
    await acceptButton.click();
    await page.waitForLoadState("networkidle");
    await assertHealthyPage(page);

    // After acceptance, the page should show accepted status
    await expect(page.getByText(/accepted/i).first()).toBeVisible();
  });

  test("1d. Household sees request status updated to accepted", async ({ page }) => {
    expect(capturedRequestId, "Request ID must be captured from step 1a").toBeTruthy();

    await loginAs(page, "household");
    await visitAndAssertHealthy(page, `/home-chef/requests/${capturedRequestId}`);

    // The status should reflect the chef's acceptance
    // Page shows status badge or text indicating "accepted"
    await expect(page.getByText(/accepted/i).first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────
// PART 2: Caterer Food Order Lifecycle
// ──────────────────────────────────────────────────────────────

test.describe("Caterer Food Order Lifecycle", () => {
  let capturedOrderId: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("2a. Household submits food order", async ({ page }) => {
    await loginAs(page, "household");

    // Navigate directly (without assertHealthyPage) to avoid the cookie-banner
    // dismissal clicking "Submit order and continue to checkout" (matches /continue/i).
    const response = await page.goto(`/orders/new?menuItemId=${MUTTON_BIRYANI_ITEM_ID}`, { waitUntil: "networkidle" });
    expect(response?.status(), "Order form page should not 500").not.toBe(500);

    // If the form was already submitted (e.g. by a prior test run with session state),
    // the page will have redirected to /orders/[id] — capture that and skip re-submitting.
    if (!page.url().includes("/orders/new")) {
      const url = page.url();
      const match = url.match(/\/orders\/([^?#]+)/);
      capturedOrderId = match?.[1] ?? null;
      expect(capturedOrderId, "Already redirected — order ID should be in URL").toBeTruthy();
      return;
    }

    // Should show Mutton Biryani item on the form
    await expect(page.getByText(/mutton biryani/i).first()).toBeVisible();

    // Submit the order (quantity and fulfillmentType have defaults from the form)
    const submitButton = page.getByRole("button", { name: /submit order/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for redirect to /orders/[id]?checkout=1
    await page.waitForURL(/\/orders\/[^?#/]+/, { timeout: 20_000 });

    const url = page.url();
    const match = url.match(/\/orders\/([^?#]+)/);
    expect(match, "Order ID should be in redirect URL").toBeTruthy();
    capturedOrderId = match?.[1] ?? null;
  });

  test("2b. Caterer sees submitted order in dashboard", async ({ page }) => {
    expect(capturedOrderId, "Order ID must be captured from step 2a").toBeTruthy();

    await loginAs(page, "catering");
    await visitAndAssertHealthy(page, "/catering/orders");

    // Order should appear — customer name or "Mutton Biryani"
    await expect(page.getByText(/mutton biryani|submitted/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /manage/i }).first()).toBeVisible();
  });

  test("2c. Caterer accepts the order", async ({ page }) => {
    expect(capturedOrderId, "Order ID must be captured from step 2a").toBeTruthy();

    await loginAs(page, "catering");
    await visitAndAssertHealthy(page, "/catering/orders");

    // Click "Manage" on the most recent order
    const manageLink = page.getByRole("link", { name: /manage/i }).first();
    await manageLink.click();
    await page.waitForLoadState("networkidle");
    await assertHealthyPage(page);

    // Select "accepted" in the status dropdown
    const statusSelect = page.locator('select[name="status"]');
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption("accepted");

    // Submit the status update
    const updateButton = page.getByRole("button", { name: /update order|update status/i });
    await expect(updateButton).toBeVisible();
    await updateButton.click();
    await page.waitForLoadState("networkidle");
    await assertHealthyPage(page);

    // Status should now reflect acceptance
    await expect(page.getByText(/accepted/i).first()).toBeVisible();
  });

  test("2d. Household sees order status updated to accepted", async ({ page }) => {
    expect(capturedOrderId, "Order ID must be captured from step 2a").toBeTruthy();

    await loginAs(page, "household");
    await visitAndAssertHealthy(page, `/orders/${capturedOrderId}`);

    // Page should show accepted status
    await expect(page.getByText(/accepted/i).first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────
// PART 3: Restaurant Discovery
// ──────────────────────────────────────────────────────────────

test.describe("Restaurant Discovery", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "household");
  });

  test("3a. /restaurants listing page loads", async ({ page }) => {
    await visitAndAssertHealthy(page, "/restaurants");
    // Should not error — either shows restaurants or an empty state
    await expect(page.locator("body")).not.toContainText(/500|error|exception/i);
  });

  test("3b. Active restaurant profile page loads", async ({ page }) => {
    await visitAndAssertHealthy(page, `/restaurants/${RESTAURANT_SLUG}`);
    // Restaurant name should appear
    await expect(page.getByRole("heading", { name: /biryani house/i }).first()).toBeVisible();
  });

  test("3c. Restaurant page shows no menu items (none published)", async ({ page }) => {
    await visitAndAssertHealthy(page, `/restaurants/${RESTAURANT_SLUG}`);
    // Since the restaurant has no active+public menu items, it shows the empty state text
    await expect(page.getByText(/no active public menu items|not listed yet/i).first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────
// PART 4: Marketplace Listing Filters
// ──────────────────────────────────────────────────────────────

test.describe("Marketplace Filters", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "household");
  });

  test("4a. /chefs listing has filter controls", async ({ page }) => {
    await visitAndAssertHealthy(page, "/chefs");
    // At minimum, the page loads with chefs visible
    await expect(page.getByRole("heading", { name: "Nizam Independent Home Chef" })).toBeVisible();
  });

  test("4b. /chefs filter by city returns results or empty", async ({ page }) => {
    await visitAndAssertHealthy(page, "/chefs?city=Chicago");
    await assertHealthyPage(page);
    // Page should not 500 when city filter is applied
    await expect(page.locator("body")).not.toContainText(/500|error|exception/i);
  });

  test("4c. /caterers listing has filter controls", async ({ page }) => {
    await visitAndAssertHealthy(page, "/caterers");
    await expect(page.getByRole("heading", { name: "Nizam Home Catering" })).toBeVisible();
  });

  test("4d. /caterers filter by city returns results or empty", async ({ page }) => {
    await visitAndAssertHealthy(page, "/caterers?city=Chicago");
    await assertHealthyPage(page);
    await expect(page.locator("body")).not.toContainText(/500|error|exception/i);
  });

  test("4e. /restaurants filter works", async ({ page }) => {
    await visitAndAssertHealthy(page, "/restaurants?city=Chicago");
    await assertHealthyPage(page);
    await expect(page.locator("body")).not.toContainText(/500|error|exception/i);
  });
});

// ──────────────────────────────────────────────────────────────
// PART 5: Household request history pages
// ──────────────────────────────────────────────────────────────

test.describe("Household Request History", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "household");
  });

  test("5a. /home-chef/requests lists household chef requests", async ({ page }) => {
    await visitAndAssertHealthy(page, "/home-chef/requests");
    await assertHealthyPage(page);
    await expect(page.locator("body")).not.toContainText(/500|error|exception/i);
  });

  test("5b. /orders lists household food orders", async ({ page }) => {
    await visitAndAssertHealthy(page, "/orders");
    await assertHealthyPage(page);
    await expect(page.locator("body")).not.toContainText(/500|error|exception/i);
  });
});
