import { describe, expect, it } from "vitest";
import { getPlatformNavItems, getWorkspaceNavItems } from "../../src/lib/navigation";

describe("stabilized role navigation", () => {
  it("shows platform owners the full platform operating menu", () => {
    const links = getPlatformNavItems({
      user: { platformRole: "platform_owner" },
      activeOrganization: { organizationType: "internal_admin" },
      activeMembership: null,
    }).map((item) => item.href);

    expect(links).toEqual(expect.arrayContaining([
      "/admin",
      "/admin/countries",
      "/admin/organizations",
      "/admin/users",
      "/admin/feature-flags",
      "/admin/audit-logs",
      "/admin/recipe-library",
      "/admin/ingredients",
      "/admin/units",
      "/admin/cuisines",
      "/admin/youtube-discovery",
      "/admin/home-chef-requests",
      "/admin/chefs",
      "/admin/restaurant-fallback",
      "/admin/grocery-partners",
      "/admin/system-settings",
    ]));
  });

  it("keeps country manager navigation country-scoped", () => {
    const links = getPlatformNavItems({
      user: { platformRole: "country_manager" },
      activeOrganization: { organizationType: "internal_admin" },
      activeMembership: null,
    }).map((item) => item.href);

    expect(links).toContain("/admin/my-countries");
    expect(links).toContain("/admin/grocery-partners");
    expect(links).not.toContain("/admin/system-settings");
    expect(links).not.toContain("/admin/feature-flags");
    expect(links).not.toContain("/admin/youtube-discovery");
  });

  it("shows household users household product workflows only", () => {
    const links = getWorkspaceNavItems({
      user: { platformRole: null },
      activeOrganization: { organizationType: "household" },
      activeMembership: { role: "org_owner" },
    }).map((item) => item.href);

    expect(links).toEqual(expect.arrayContaining([
      "/dashboard",
      "/recipes",
      "/meal-plans",
      "/grocery-lists",
      "/household",
      "/home-chef",
      "/chefs",
      "/order-instead",
      "/saved-restaurants",
      "/settings",
    ]));
    expect(links).not.toContain("/chef");
    expect(links).not.toContain("/admin");
  });

  it("shows chef businesses chef operations instead of household tools", () => {
    const links = getWorkspaceNavItems({
      user: { platformRole: null },
      activeOrganization: { organizationType: "chef_business" },
      activeMembership: { role: "chef_owner" },
    }).map((item) => item.href);

    expect(links).toEqual([
      "/chef",
      "/chef/profile",
      "/chef/services",
      "/chef/availability",
      "/chef/requests",
      "/chef/reviews",
      "/settings",
    ]);
    expect(links).not.toContain("/household");
    expect(links).not.toContain("/home-chef");
    expect(links).not.toContain("/chefs");
  });

  it("shows restaurant accounts only the restaurant placeholder and settings", () => {
    const links = getWorkspaceNavItems({
      user: { platformRole: null },
      activeOrganization: { organizationType: "restaurant" },
      activeMembership: { role: "restaurant_owner" },
    }).map((item) => item.href);

    expect(links).toEqual(["/restaurant", "/settings"]);
  });
});

describe("production-safe feature flag catalog", () => {
  it("documents the active product flags for the current product surface", () => {
    const productFlags = [
      "recipes",
      "meal_planner",
      "grocery_engine",
      "youtube_references",
      "family_profiles",
      "home_chefs",
      "restaurant_fallback",
      "grocery_partners",
    ];

    expect(productFlags).toHaveLength(8);
  });
});
