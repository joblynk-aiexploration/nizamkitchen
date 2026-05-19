import { prisma } from "@/lib/prisma";
import { assertMembershipAccess } from "@/lib/auth";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

function weekBounds() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return { weekStart: start, weekEnd: now };
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { monthStart: start, monthEnd: now };
}

export async function getHouseholdReportData(session: Session) {
  assertMembershipAccess(session);
  const orgId = session.activeOrganization.id;
  const { weekStart, weekEnd } = weekBounds();
  const { monthStart, monthEnd } = monthBounds();

  const [
    mealsPlannedThisWeek,
    groceryListsThisMonth,
    allGroceryListsCount,
    mostCookedRecipes,
    favoriteRecipes,
    groceryItemsByCategory,
    avoidedIngredients,
    homeChefRequestsByStatus,
    savedRestaurantsCount,
    restaurantSearchesCount,
    restaurantSearchesThisMonth,
  ] = await Promise.all([
    // Meals planned this week (entries in any meal plan for this org in the last 7 days)
    prisma.mealPlanEntry.count({
      where: {
        mealPlanDay: {
          date: { gte: weekStart, lte: weekEnd },
          mealPlan: { organizationId: orgId },
        },
      },
    }),

    // Grocery lists generated this month
    prisma.groceryList.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }),

    // All-time grocery lists
    prisma.groceryList.count({ where: { organizationId: orgId } }),

    // Most cooked recipes (mealPlanEntry status=cooked, group by recipeId)
    prisma.mealPlanEntry.groupBy({
      by: ["recipeId"],
      where: {
        mealPlanDay: { mealPlan: { organizationId: orgId } },
        status: "cooked",
        recipeId: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { recipeId: "desc" } },
      take: 5,
    }),

    // Favorite recipes
    prisma.favoriteRecipe.findMany({
      where: { organizationId: orgId },
      include: { recipe: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    // Grocery items by category (from active/completed lists this month)
    prisma.groceryListItem.groupBy({
      by: ["category"],
      where: {
        groceryList: {
          organizationId: orgId,
          createdAt: { gte: monthStart },
        },
      },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 8,
    }),

    // Avoided ingredients
    prisma.avoidedIngredient.findMany({
      where: { organizationId: orgId },
      orderBy: { severity: "asc" },
    }),

    // Home chef requests by status
    prisma.homeChefRequest.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { _all: true },
    }),

    // Saved restaurants
    prisma.savedRestaurant.count({ where: { organizationId: orgId } }),

    // All restaurant searches
    prisma.restaurantFallbackSearch.count({ where: { organizationId: orgId } }),

    // Restaurant searches this month
    prisma.restaurantFallbackSearch.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }),
  ]);

  // Resolve recipe names for most cooked
  const recipeIds = mostCookedRecipes
    .map((r) => r.recipeId)
    .filter(Boolean) as string[];
  const recipeNames = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, name: true },
  });
  const recipeNameMap = Object.fromEntries(recipeNames.map((r) => [r.id, r.name]));

  return {
    mealsPlannedThisWeek,
    groceryListsThisMonth,
    allGroceryListsCount,
    mostCookedRecipes: mostCookedRecipes.map((r) => ({
      recipeId: r.recipeId!,
      recipeName: recipeNameMap[r.recipeId!] ?? "Unknown",
      count: r._count._all,
    })),
    favoriteRecipes: favoriteRecipes.map((f) => ({
      recipeId: f.recipeId,
      recipeName: f.recipe.name,
    })),
    groceryItemsByCategory: groceryItemsByCategory.map((g) => ({
      category: g.category,
      count: g._count._all,
    })),
    avoidedIngredients,
    homeChefRequestsByStatus: homeChefRequestsByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    homeChefRequestsTotal: homeChefRequestsByStatus.reduce((s, r) => s + r._count._all, 0),
    savedRestaurantsCount,
    restaurantSearchesCount,
    restaurantSearchesThisMonth,
  };
}
