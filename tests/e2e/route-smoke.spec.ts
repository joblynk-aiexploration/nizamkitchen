import { test } from "@playwright/test";
import { loginAs, visitAndAssertHealthy } from "./helpers";

const publicRoutes = [
  "/",
  "/features",
  "/pricing",
  "/for-households",
  "/for-chefs",
  "/caterers",
  "/for-restaurants",
  "/restaurants",
  "/about",
  "/contact",
  "/help",
  "/faq",
  "/terms",
  "/privacy",
  "/legal/terms",
  "/legal/privacy",
  "/login",
  "/register",
];

const ownerRoutes = [
  "/admin",
  "/admin/users",
  "/admin/organizations",
  "/admin/feature-flags",
  "/admin/billing",
  "/admin/payments",
  "/admin/storage",
  "/admin/dropbox",
  "/admin/verifications",
  "/admin/apis",
  "/admin/accounting",
  "/admin/content",
  "/admin/system",
  "/admin/policies",
  "/admin/reports",
];

const householdRoutes = [
  "/dashboard",
  "/recipes",
  "/meal-plans",
  "/grocery-lists",
  "/household",
  "/home-chef",
  "/chefs",
  "/caterers",
  "/orders",
  "/billing",
  "/privacy-center",
  "/support",
  "/settings",
  "/profile",
  "/notifications",
];

const chefRoutes = ["/chef", "/chef/requests", "/chef/profile", "/chef/availability", "/notifications", "/settings"];
const restaurantRoutes = ["/restaurant", "/restaurant/profile", "/restaurant/menu", "/restaurant/menu-items", "/restaurant/orders", "/restaurant/fulfillment", "/restaurant/promotions", "/restaurant/verification"];
const cateringRoutes = ["/catering", "/catering/profile", "/catering/menu", "/catering/menu-items", "/catering/orders", "/catering/fulfillment", "/catering/promotions", "/catering/verification"];

test.describe("route smoke coverage", () => {
  test("public routes render without runtime failures", async ({ page }) => {
    for (const route of publicRoutes) {
      await visitAndAssertHealthy(page, route);
    }
  });

  test("platform owner admin routes render without runtime failures", async ({ page }) => {
    await loginAs(page, "owner");
    for (const route of ownerRoutes) {
      await visitAndAssertHealthy(page, route);
    }
  });

  test("household routes render without runtime failures", async ({ page }) => {
    await loginAs(page, "household");
    for (const route of householdRoutes) {
      await visitAndAssertHealthy(page, route);
    }
  });

  test("chef routes render without runtime failures", async ({ page }) => {
    await loginAs(page, "chef");
    for (const route of chefRoutes) {
      await visitAndAssertHealthy(page, route);
    }
  });

  test("restaurant routes render without runtime failures", async ({ page }) => {
    await loginAs(page, "restaurant");
    for (const route of restaurantRoutes) {
      await visitAndAssertHealthy(page, route);
    }
  });

  test("home catering routes render without runtime failures", async ({ page }) => {
    await loginAs(page, "catering");
    for (const route of cateringRoutes) {
      await visitAndAssertHealthy(page, route);
    }
  });
});
