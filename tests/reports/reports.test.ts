import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    recipe: { count: vi.fn(), findMany: vi.fn() },
    mealPlan: { count: vi.fn() },
    mealPlanEntry: { count: vi.fn(), groupBy: vi.fn() },
    groceryList: { count: vi.fn() },
    groceryListItem: { groupBy: vi.fn() },
    homeChefRequest: { groupBy: vi.fn() },
    chefProfile: { groupBy: vi.fn() },
    restaurantFallbackSearch: { count: vi.fn(), groupBy: vi.fn() },
    savedRestaurant: { count: vi.fn() },
    featureFlag: { count: vi.fn() },
    billingSubscription: { groupBy: vi.fn() },
    favoriteRecipe: { findMany: vi.fn() },
    avoidedIngredient: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({
  assertPlatformRole: vi.fn(),
  assertMembershipAccess: vi.fn(),
  AccessDeniedError: class AccessDeniedError extends Error {
    code = "access_denied";
  },
}));

import { getAdminReportData } from "../../src/server/reports/admin-reports";
import { getHouseholdReportData } from "../../src/server/reports/household-reports";
import { getWorkspaceNavItems, getPlatformNavItems } from "../../src/lib/navigation";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAdminSession(role = "platform_admin") {
  return {
    user: { id: "u1", platformRole: role },
    countryAssignments: [],
    activeOrganization: null,
    activeMembership: null,
  } as never;
}

function makeHouseholdSession() {
  return {
    user: { id: "u1", platformRole: null },
    activeOrganization: { id: "org1", organizationType: "household" },
    activeMembership: { role: "owner" },
    countryAssignments: [],
  } as never;
}

// ─── Admin report data ────────────────────────────────────────────────────────

describe("getAdminReportData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.organization.count.mockResolvedValue(10);
    mockPrisma.organization.groupBy.mockResolvedValue([
      { organizationType: "household", _count: { _all: 6 } },
      { organizationType: "chef_business", _count: { _all: 2 } },
      { organizationType: "restaurant", _count: { _all: 2 } },
    ]);
    mockPrisma.organization.findMany.mockResolvedValue([]);
    mockPrisma.recipe.count.mockResolvedValue(50);
    mockPrisma.mealPlan.count.mockResolvedValue(20);
    mockPrisma.groceryList.count.mockResolvedValue(30);
    mockPrisma.homeChefRequest.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 3 } },
      { status: "completed", _count: { _all: 7 } },
    ]);
    mockPrisma.chefProfile.groupBy.mockResolvedValue([
      { status: "active", _count: { _all: 5 } },
    ]);
    mockPrisma.restaurantFallbackSearch.groupBy.mockResolvedValue([
      { status: "completed", _count: { _all: 15 } },
    ]);
    mockPrisma.savedRestaurant.count.mockResolvedValue(8);
    mockPrisma.featureFlag.count.mockResolvedValue(12);
    mockPrisma.billingSubscription.groupBy.mockResolvedValue([]);
  });

  it("returns aggregated platform metrics", async () => {
    const data = await getAdminReportData(makeAdminSession());
    expect(data.totalOrganizations).toBe(10);
    expect(data.householdCount).toBe(6);
    expect(data.chefBusinessCount).toBe(2);
    expect(data.restaurantPartnerCount).toBe(2);
  });

  it("calculates homeChefTotal from grouped statuses", async () => {
    const data = await getAdminReportData(makeAdminSession());
    expect(data.homeChefTotal).toBe(10);
  });

  it("calculates chefProfilesActive and total", async () => {
    const data = await getAdminReportData(makeAdminSession());
    expect(data.chefProfilesActive).toBe(5);
    expect(data.chefProfilesTotal).toBe(5);
  });

  it("returns restaurantSearchTotal", async () => {
    const data = await getAdminReportData(makeAdminSession());
    expect(data.restaurantSearchTotal).toBe(15);
  });

  it("handles zero published recipes for videoCoveragePct", async () => {
    // recipe.count called twice: total then published — second call (published) = 0
    mockPrisma.recipe.count
      .mockResolvedValueOnce(50)  // total
      .mockResolvedValueOnce(0)   // published
      .mockResolvedValueOnce(0);  // with video
    const data = await getAdminReportData(makeAdminSession());
    expect(data.videoCoveragePct).toBe(0);
  });

  it("scopes queries by countryCode for country_manager", async () => {
    const session = {
      user: { id: "u1", platformRole: "country_manager" },
      countryAssignments: [{ countryCode: "NG" }],
      activeOrganization: null,
      activeMembership: null,
    } as never;

    await getAdminReportData(session);

    // organization.count should have been called with countryCode filter
    expect(mockPrisma.organization.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryCode: { in: ["NG"] } } }),
    );
  });
});

// ─── Household report data ─────────────────────────────────────────────────

describe("getHouseholdReportData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.mealPlanEntry.count.mockResolvedValue(5);
    mockPrisma.groceryList.count.mockResolvedValue(3);
    mockPrisma.mealPlanEntry.groupBy.mockResolvedValue([]);
    mockPrisma.recipe.findMany.mockResolvedValue([]);
    mockPrisma.favoriteRecipe.findMany.mockResolvedValue([]);
    mockPrisma.groceryListItem.groupBy.mockResolvedValue([]);
    mockPrisma.avoidedIngredient.findMany.mockResolvedValue([]);
    mockPrisma.homeChefRequest.groupBy.mockResolvedValue([]);
    mockPrisma.savedRestaurant.count.mockResolvedValue(2);
    mockPrisma.restaurantFallbackSearch.count.mockResolvedValue(7);
  });

  it("returns meal plans count for the week", async () => {
    const data = await getHouseholdReportData(makeHouseholdSession());
    expect(data.mealsPlannedThisWeek).toBe(5);
  });

  it("returns savedRestaurantsCount", async () => {
    const data = await getHouseholdReportData(makeHouseholdSession());
    expect(data.savedRestaurantsCount).toBe(2);
  });

  it("returns empty mostCookedRecipes when none cooked", async () => {
    const data = await getHouseholdReportData(makeHouseholdSession());
    expect(data.mostCookedRecipes).toHaveLength(0);
  });

  it("returns homeChefRequestsTotal as 0 when no requests", async () => {
    const data = await getHouseholdReportData(makeHouseholdSession());
    expect(data.homeChefRequestsTotal).toBe(0);
  });

  it("calculates homeChefRequestsTotal from grouped rows", async () => {
    mockPrisma.homeChefRequest.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 2 } },
      { status: "completed", _count: { _all: 4 } },
    ]);
    const data = await getHouseholdReportData(makeHouseholdSession());
    expect(data.homeChefRequestsTotal).toBe(6);
  });
});

// ─── Navigation: reports links ────────────────────────────────────────────────

describe("reports navigation", () => {
  it("includes /reports in household workspace nav", () => {
    const session = {
      user: { platformRole: null },
      activeMembership: { role: "owner" },
      activeOrganization: { organizationType: "household" },
    } as never;
    const items = getWorkspaceNavItems(session);
    expect(items.some((i) => i.href === "/reports")).toBe(true);
  });

  it("includes /admin/reports in platform_admin nav", () => {
    const session = {
      user: { platformRole: "platform_admin" },
      activeMembership: null,
      activeOrganization: null,
    } as never;
    const items = getPlatformNavItems(session);
    expect(items.some((i) => i.href === "/admin/reports")).toBe(true);
  });

  it("includes /admin/reports in country_manager nav", () => {
    const session = {
      user: { platformRole: "country_manager" },
      activeMembership: null,
      activeOrganization: null,
    } as never;
    const items = getPlatformNavItems(session);
    expect(items.some((i) => i.href === "/admin/reports")).toBe(true);
  });

  it("labels /admin/reports as 'Reports'", () => {
    const session = {
      user: { platformRole: "platform_admin" },
      activeMembership: null,
      activeOrganization: null,
    } as never;
    const items = getPlatformNavItems(session);
    const item = items.find((i) => i.href === "/admin/reports");
    expect(item?.label).toBe("Reports");
  });

  it("does not include /admin/reports in auditor nav", () => {
    const session = {
      user: { platformRole: "auditor" },
      activeMembership: null,
      activeOrganization: null,
    } as never;
    const items = getPlatformNavItems(session);
    expect(items.some((i) => i.href === "/admin/reports")).toBe(false);
  });
});
