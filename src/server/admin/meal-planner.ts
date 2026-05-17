import { prisma } from "@/lib/prisma";
import { assertPlatformRole } from "@/lib/auth";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function getAdminMealPlannerData(session: Session) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
    "country_manager",
  ]);

  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);

  const mealPlanWhere = isCountryManager ? { countryCode: { in: assignedCountries } } : {};
  const groceryWhere = isCountryManager
    ? { sourceType: "meal_plan" as const, countryCode: { in: assignedCountries } }
    : { sourceType: "meal_plan" as const };

  const [
    totalMealPlans,
    activeMealPlans,
    mealPlansByCountryRaw,
    mostPlannedRecipesRaw,
    mealPlanGroceryLists,
  ] = await Promise.all([
    prisma.mealPlan.count({ where: mealPlanWhere }),
    prisma.mealPlan.count({ where: { ...mealPlanWhere, status: "active" } }),
    prisma.mealPlan.groupBy({
      by: ["countryCode"],
      _count: { _all: true },
      where: mealPlanWhere,
    }),
    prisma.mealPlanEntry.groupBy({
      by: ["recipeId"],
      _count: { _all: true },
      where: {
        recipeId: { not: null },
        mealPlanDay: {
          mealPlan: mealPlanWhere,
        },
      },
      orderBy: { _count: { recipeId: "desc" } },
      take: 8,
    }),
    prisma.groceryList.count({ where: groceryWhere }),
  ]);

  const recipeIds = mostPlannedRecipesRaw
    .map((row) => row.recipeId)
    .filter((value): value is string => Boolean(value));
  const recipes = recipeIds.length > 0
    ? await prisma.recipe.findMany({
        where: { id: { in: recipeIds } },
        select: { id: true, name: true },
      })
    : [];
  const recipeNameMap = new Map(recipes.map((recipe) => [recipe.id, recipe.name]));

  return {
    totalMealPlans,
    activeMealPlans,
    groceryListsGenerated: mealPlanGroceryLists,
    mealPlansByCountry: mealPlansByCountryRaw.map((row) => ({
      countryCode: row.countryCode,
      count: row._count._all,
    })),
    mostPlannedRecipes: mostPlannedRecipesRaw.map((row) => ({
      recipeId: row.recipeId,
      recipeName: row.recipeId ? recipeNameMap.get(row.recipeId) ?? "Unknown recipe" : "Custom meals",
      count: row._count._all,
    })),
  };
}
