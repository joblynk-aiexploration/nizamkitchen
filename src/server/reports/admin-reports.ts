import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPlatformRole } from "@/lib/auth";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function getAdminReportData(session: Session) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);

  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = (session.countryAssignments ?? []).map(
    (a) => a.countryCode,
  );

  const orgWhere: Prisma.OrganizationWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};

  const mealPlanWhere: Prisma.MealPlanWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};

  const groceryWhere: Prisma.GroceryListWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};

  const chefRequestWhere: Prisma.HomeChefRequestWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};

  const restaurantWhere: Prisma.RestaurantFallbackSearchWhereInput =
    isCountryManager ? { countryCode: { in: assignedCountries } } : {};

  const menuItemWhere: Prisma.MenuItemWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};

  const foodOrderWhere: Prisma.FoodOrderWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};

  const [
    totalOrganizations,
    orgsByType,
    orgsByCountry,
    totalRecipes,
    publishedRecipes,
    recipesWithVideo,
    totalMealPlans,
    totalGroceryLists,
    homeChefRequestsByStatus,
    chefProfilesByStatus,
    restaurantSearchesByStatus,
    savedRestaurantsCount,
    enabledFlagsCount,
    totalFlagsCount,
    subscriptionsByPlan,
    recentOrgs,
    homeCateringSellersCount,
    activeMenuItemsCount,
    foodOrdersByStatus,
    topRequestedDishes,
    restaurantsWithMenusCount,
    businessSocialLinksCount,
  ] = await Promise.all([
    prisma.organization.count({ where: orgWhere }),

    prisma.organization.groupBy({
      by: ["organizationType"],
      where: orgWhere,
      _count: { _all: true },
    }),

    prisma.organization.groupBy({
      by: ["countryCode"],
      where: orgWhere,
      _count: { _all: true },
      orderBy: { _count: { countryCode: "desc" } },
      take: 10,
    }),

    prisma.recipe.count(),
    prisma.recipe.count({ where: { isPublished: true } }),

    // Recipes that have at least one media reference (YouTube coverage)
    prisma.recipe.count({
      where: { mediaRefs: { some: { type: "youtube" } } },
    }),

    prisma.mealPlan.count({ where: mealPlanWhere }),
    prisma.groceryList.count({ where: groceryWhere }),

    prisma.homeChefRequest.groupBy({
      by: ["status"],
      where: chefRequestWhere,
      _count: { _all: true },
    }),

    prisma.chefProfile.groupBy({
      by: ["status"],
      where: isCountryManager
        ? { countryCode: { in: assignedCountries } }
        : {},
      _count: { _all: true },
    }),

    prisma.restaurantFallbackSearch.groupBy({
      by: ["status"],
      where: restaurantWhere,
      _count: { _all: true },
    }),

    prisma.savedRestaurant.count(
      isCountryManager
        ? { where: { countryCode: { in: assignedCountries } } }
        : undefined,
    ),

    prisma.featureFlag.count({ where: { enabled: true } }),
    prisma.featureFlag.count(),

    prisma.billingSubscription.groupBy({
      by: ["planId"],
      _count: { _all: true },
      where: isCountryManager
        ? { organization: { countryCode: { in: assignedCountries } } }
        : {},
    }),

    prisma.organization.findMany({
      where: orgWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        organizationType: true,
        countryCode: true,
        status: true,
        createdAt: true,
      },
    }),

    prisma.homeCateringProfile.count({
      where: isCountryManager ? { countryCode: { in: assignedCountries } } : {},
    }),

    prisma.menuItem.count({ where: { ...menuItemWhere, status: "active" } }),

    prisma.foodOrder.groupBy({
      by: ["status"],
      where: foodOrderWhere,
      _count: { _all: true },
    }),

    prisma.foodOrderItem.groupBy({
      by: ["nameSnapshot"],
      where: isCountryManager ? { order: { countryCode: { in: assignedCountries } } } : {},
      _count: { _all: true },
      orderBy: { _count: { nameSnapshot: "desc" } },
      take: 5,
    }),

    prisma.organization.count({
      where: {
        ...orgWhere,
        organizationType: "restaurant",
        menuItems: { some: { status: { in: ["active", "sold_out"] } } },
      },
    }),

    prisma.businessSocialLink.count({
      where: isCountryManager ? { organization: { countryCode: { in: assignedCountries } } } : {},
    }),
  ]);

  const orgsByTypeMap = Object.fromEntries(
    orgsByType.map((r) => [r.organizationType, r._count._all]),
  ) as Record<string, number>;

  const homeChefTotal = homeChefRequestsByStatus.reduce(
    (s, r) => s + r._count._all,
    0,
  );

  const restaurantSearchTotal = restaurantSearchesByStatus.reduce(
    (s, r) => s + r._count._all,
    0,
  );

  const chefProfilesActive =
    chefProfilesByStatus.find((r) => r.status === "active")?._count._all ?? 0;
  const chefProfilesTotal = chefProfilesByStatus.reduce(
    (s, r) => s + r._count._all,
    0,
  );

  const videoCoveragePct =
    publishedRecipes > 0
      ? Math.round((recipesWithVideo / publishedRecipes) * 100)
      : 0;

  return {
    isCountryManager,
    assignedCountries,
    totalOrganizations,
    householdCount: orgsByTypeMap["household"] ?? 0,
    chefBusinessCount: orgsByTypeMap["chef_business"] ?? 0,
    restaurantPartnerCount: orgsByTypeMap["restaurant"] ?? 0,
    orgsByType: orgsByType.map((r) => ({
      type: r.organizationType,
      count: r._count._all,
    })),
    orgsByCountry: orgsByCountry.map((r) => ({
      countryCode: r.countryCode,
      count: r._count._all,
    })),
    totalRecipes,
    publishedRecipes,
    recipesWithVideo,
    videoCoveragePct,
    totalMealPlans,
    totalGroceryLists,
    homeChefRequestsByStatus: homeChefRequestsByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    homeChefTotal,
    chefProfilesActive,
    chefProfilesTotal,
    restaurantSearchesByStatus: restaurantSearchesByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    restaurantSearchTotal,
    savedRestaurantsCount,
    enabledFlagsCount,
    totalFlagsCount,
    subscriptionsByPlan,
    recentOrgs,
    homeCateringSellersCount,
    activeMenuItemsCount,
    foodOrdersByStatus: foodOrdersByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    foodOrdersTotal: foodOrdersByStatus.reduce((s, r) => s + r._count._all, 0),
    topRequestedDishes: topRequestedDishes.map((r) => ({
      name: r.nameSnapshot,
      count: r._count._all,
    })),
    restaurantsWithMenusCount,
    businessSocialLinksCount,
  };
}

// ─── CSV export helpers ───────────────────────────────────────────────────────

function csvRow(values: (string | number | Date | null | undefined)[]): string {
  return values
    .map((v) => {
      if (v == null) return "";
      const s = v instanceof Date ? v.toISOString() : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(",");
}

function buildCsv(
  headers: string[],
  rows: (string | number | Date | null | undefined)[][],
): string {
  return [headers.join(","), ...rows.map(csvRow)].join("\n");
}

export async function exportOrganizationsCSV(session: Session): Promise<string> {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
    "country_manager",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = (session.countryAssignments ?? []).map(
    (a) => a.countryCode,
  );

  const rows = await prisma.organization.findMany({
    where: isCountryManager ? { countryCode: { in: assignedCountries } } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationType: true,
      status: true,
      countryCode: true,
      currencyCode: true,
      createdAt: true,
    },
  });

  return buildCsv(
    ["id", "name", "slug", "type", "status", "country", "currency", "created_at"],
    rows.map((r) => [r.id, r.name, r.slug, r.organizationType, r.status, r.countryCode, r.currencyCode, r.createdAt]),
  );
}

export async function exportHomeChefRequestsCSV(session: Session): Promise<string> {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
    "country_manager",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = (session.countryAssignments ?? []).map(
    (a) => a.countryCode,
  );

  const rows = await prisma.homeChefRequest.findMany({
    where: isCountryManager ? { countryCode: { in: assignedCountries } } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      requestType: true,
      title: true,
      countryCode: true,
      guestCount: true,
      requestedDate: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
  });

  return buildCsv(
    ["id", "organization", "title", "type", "status", "country", "guests", "requested_date", "created_at"],
    rows.map((r) => [
      r.id, r.organization.name, r.title, r.requestType, r.status,
      r.countryCode, r.guestCount, r.requestedDate, r.createdAt,
    ]),
  );
}

export async function exportChefProfilesCSV(session: Session): Promise<string> {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = (session.countryAssignments ?? []).map(
    (a) => a.countryCode,
  );

  const rows = await prisma.chefProfile.findMany({
    where: isCountryManager ? { countryCode: { in: assignedCountries } } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      slug: true,
      status: true,
      verificationStatus: true,
      countryCode: true,
      averageRating: true,
      ratingCount: true,
      isPublic: true,
      createdAt: true,
    },
  });

  return buildCsv(
    ["id", "display_name", "slug", "status", "verification", "country", "rating", "rating_count", "public", "created_at"],
    rows.map((r) => [
      r.id, r.displayName, r.slug, r.status, r.verificationStatus,
      r.countryCode, r.averageRating ?? "", r.ratingCount, r.isPublic ? "yes" : "no", r.createdAt,
    ]),
  );
}

export async function exportRestaurantSearchesCSV(session: Session): Promise<string> {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = (session.countryAssignments ?? []).map(
    (a) => a.countryCode,
  );

  const rows = await prisma.restaurantFallbackSearch.findMany({
    where: isCountryManager ? { countryCode: { in: assignedCountries } } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      query: true,
      status: true,
      countryCode: true,
      city: true,
      resultCount: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
  });

  return buildCsv(
    ["id", "organization", "query", "status", "country", "city", "results", "created_at"],
    rows.map((r) => [
      r.id, r.organization.name, r.query, r.status,
      r.countryCode, r.city ?? "", r.resultCount, r.createdAt,
    ]),
  );
}

export async function exportGroceryUsageCSV(session: Session): Promise<string> {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = (session.countryAssignments ?? []).map(
    (a) => a.countryCode,
  );

  const rows = await prisma.groceryList.findMany({
    where: isCountryManager
      ? { countryCode: { in: assignedCountries } }
      : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      sourceType: true,
      countryCode: true,
      createdAt: true,
      organization: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return buildCsv(
    ["id", "organization", "name", "status", "source", "country", "item_count", "created_at"],
    rows.map((r) => [
      r.id, r.organization.name, r.name, r.status, r.sourceType,
      r.countryCode ?? "", r._count.items, r.createdAt,
    ]),
  );
}
