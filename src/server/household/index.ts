import { Prisma, type MeasurementSystem, type PlatformRole, type SpiceLevel } from "@prisma/client";
import { hasPlatformRole, PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import {
  avoidedIngredientCreateSchema,
  favoriteRecipeSchema,
  householdProfileSchema,
  pantryItemSchema,
} from "@/lib/validation/household";
import { createAuditEvent } from "@/server/audit";

const householdProfileInclude = Prisma.validator<Prisma.HouseholdProfileDefaultArgs>()({
  include: { organization: { select: { id: true, name: true, organizationType: true, countryCode: true } } },
});

export type HouseholdProfileDetail = Prisma.HouseholdProfileGetPayload<typeof householdProfileInclude>;

export async function canAccessFamilyProfiles(params: {
  organizationId: string;
  platformRole: PlatformRole | null | undefined;
}) {
  if (hasPlatformRole(params.platformRole, PLATFORM_ADMIN_ROLES)) return true;
  return isFeatureEnabled("family_profiles", params.organizationId);
}

export function isHouseholdOrganization(organizationType: string) {
  return organizationType === "household";
}

export async function getHouseholdProfile(organizationId: string) {
  return prisma.householdProfile.findUnique({
    where: { organizationId },
    ...householdProfileInclude,
  });
}

export async function getHouseholdOverview(organizationId: string) {
  const [profile, avoidedIngredients, favorites, pantryItems] = await Promise.all([
    getHouseholdProfile(organizationId),
    listAvoidedIngredients(organizationId),
    listFavoriteRecipes(organizationId),
    listPantryItems(organizationId),
  ]);

  return { profile, avoidedIngredients, favorites, pantryItems };
}

export async function upsertHouseholdProfile(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = householdProfileSchema.parse(params.input);
  const existing = await prisma.householdProfile.findUnique({
    where: { organizationId: params.organizationId },
    select: { id: true },
  });

  const profile = await prisma.householdProfile.upsert({
    where: { organizationId: params.organizationId },
    update: {
      countryCode: parsed.countryCode,
      displayName: parsed.displayName,
      defaultHouseholdSize: parsed.defaultHouseholdSize,
      adultsCount: parsed.adultsCount ?? null,
      childrenCount: parsed.childrenCount ?? null,
      defaultServings: parsed.defaultServings,
      defaultSpiceLevel: parsed.defaultSpiceLevel as SpiceLevel,
      preferredMeasurementSystem: parsed.preferredMeasurementSystem as MeasurementSystem,
      preferredCuisineIds: parsed.preferredCuisineIds,
      cookingSkillLevel: parsed.cookingSkillLevel,
      weeklyCookingDays: parsed.weeklyCookingDays,
      groceryBudgetAmount: parsed.groceryBudgetAmount ?? null,
      groceryBudgetCurrency: parsed.groceryBudgetCurrency ?? null,
      notes: parsed.notes ?? null,
    },
    create: {
      organizationId: params.organizationId,
      countryCode: parsed.countryCode,
      displayName: parsed.displayName,
      defaultHouseholdSize: parsed.defaultHouseholdSize,
      adultsCount: parsed.adultsCount ?? null,
      childrenCount: parsed.childrenCount ?? null,
      defaultServings: parsed.defaultServings,
      defaultSpiceLevel: parsed.defaultSpiceLevel as SpiceLevel,
      preferredMeasurementSystem: parsed.preferredMeasurementSystem as MeasurementSystem,
      preferredCuisineIds: parsed.preferredCuisineIds,
      cookingSkillLevel: parsed.cookingSkillLevel,
      weeklyCookingDays: parsed.weeklyCookingDays,
      groceryBudgetAmount: parsed.groceryBudgetAmount ?? null,
      groceryBudgetCurrency: parsed.groceryBudgetCurrency ?? null,
      notes: parsed.notes ?? null,
    },
  });

  await syncMealPlanPreferenceFromHousehold(params.organizationId, parsed);

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: parsed.countryCode,
    action: existing ? "household_profile.updated" : "household_profile.created",
    targetType: "household_profile",
    targetId: profile.id,
    details: {
      displayName: parsed.displayName,
      defaultHouseholdSize: parsed.defaultHouseholdSize,
      defaultServings: parsed.defaultServings,
    },
  });

  return profile;
}

async function syncMealPlanPreferenceFromHousehold(
  organizationId: string,
  parsed: ReturnType<typeof householdProfileSchema.parse>,
) {
  await prisma.mealPlanPreference.upsert({
    where: { organizationId },
    update: {
      defaultHouseholdSize: parsed.defaultHouseholdSize,
      defaultCountryCode: parsed.countryCode,
      preferredCuisines: parsed.preferredCuisineIds,
      spicePreference: parsed.defaultSpiceLevel as SpiceLevel,
      weeklyCookingDays: parsed.weeklyCookingDays,
      measurementSystem: parsed.preferredMeasurementSystem as MeasurementSystem,
    },
    create: {
      organizationId,
      defaultHouseholdSize: parsed.defaultHouseholdSize,
      defaultCountryCode: parsed.countryCode,
      preferredCuisines: parsed.preferredCuisineIds,
      avoidedIngredients: [],
      spicePreference: parsed.defaultSpiceLevel as SpiceLevel,
      weeklyCookingDays: parsed.weeklyCookingDays,
      measurementSystem: parsed.preferredMeasurementSystem as MeasurementSystem,
    },
  });
}

export async function listAvoidedIngredients(organizationId: string) {
  return prisma.avoidedIngredient.findMany({
    where: { organizationId },
    include: { ingredient: { select: { id: true, name: true, category: true } } },
    orderBy: [{ severity: "desc" }, { ingredientName: "asc" }],
  });
}

export async function addAvoidedIngredient(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = avoidedIngredientCreateSchema.parse(params.input);
  const item = await prisma.avoidedIngredient.create({
    data: {
      organizationId: params.organizationId,
      ingredientId: parsed.ingredientId ?? null,
      ingredientName: parsed.ingredientName,
      reason: parsed.reason ?? null,
      severity: parsed.severity,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "avoided_ingredient.created",
    targetType: "avoided_ingredient",
    targetId: item.id,
    details: { ingredientName: item.ingredientName, severity: item.severity },
  });

  return item;
}

export async function deleteAvoidedIngredient(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  avoidedIngredientId: string;
}) {
  const existing = await prisma.avoidedIngredient.findFirst({
    where: { id: params.avoidedIngredientId, organizationId: params.organizationId },
  });
  if (!existing) throw new Error("Avoided ingredient not found.");

  await prisma.avoidedIngredient.delete({ where: { id: existing.id } });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "avoided_ingredient.deleted",
    targetType: "avoided_ingredient",
    targetId: existing.id,
    details: { ingredientName: existing.ingredientName },
  });
}

export async function listFavoriteRecipes(organizationId: string) {
  return prisma.favoriteRecipe.findMany({
    where: { organizationId },
    include: { recipe: { include: { cuisine: true } }, createdBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function isFavoriteRecipe(organizationId: string, recipeId: string) {
  const count = await prisma.favoriteRecipe.count({ where: { organizationId, recipeId } });
  return count > 0;
}

export async function addFavoriteRecipe(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = favoriteRecipeSchema.parse(params.input);
  const favorite = await prisma.favoriteRecipe.upsert({
    where: { organizationId_recipeId: { organizationId: params.organizationId, recipeId: parsed.recipeId } },
    update: {},
    create: {
      organizationId: params.organizationId,
      recipeId: parsed.recipeId,
      createdById: params.actorUserId,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "favorite_recipe.created",
    targetType: "favorite_recipe",
    targetId: favorite.id,
    details: { recipeId: parsed.recipeId },
  });

  return favorite;
}

export async function removeFavoriteRecipe(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  recipeId: string;
}) {
  const existing = await prisma.favoriteRecipe.findUnique({
    where: { organizationId_recipeId: { organizationId: params.organizationId, recipeId: params.recipeId } },
  });
  if (!existing) return;

  await prisma.favoriteRecipe.delete({ where: { id: existing.id } });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "favorite_recipe.deleted",
    targetType: "favorite_recipe",
    targetId: existing.id,
    details: { recipeId: params.recipeId },
  });
}

export async function listPantryItems(organizationId: string) {
  return prisma.householdPantryItem.findMany({
    where: { organizationId },
    include: { ingredient: true, unit: true },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
  });
}

export async function addPantryItem(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = pantryItemSchema.parse(params.input);
  const item = await prisma.householdPantryItem.create({
    data: {
      organizationId: params.organizationId,
      ingredientId: parsed.ingredientId,
      quantity: parsed.quantity ?? null,
      unitId: parsed.unitId ?? null,
      notes: parsed.notes ?? null,
      expiresAt: parsed.expiresAt ?? null,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "pantry_item.created",
    targetType: "household_pantry_item",
    targetId: item.id,
    details: { ingredientId: item.ingredientId },
  });

  return item;
}

export async function updatePantryItem(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  pantryItemId: string;
  input: unknown;
}) {
  const parsed = pantryItemSchema.parse(params.input);
  const existing = await prisma.householdPantryItem.findFirst({
    where: { id: params.pantryItemId, organizationId: params.organizationId },
  });
  if (!existing) throw new Error("Pantry item not found.");

  const item = await prisma.householdPantryItem.update({
    where: { id: existing.id },
    data: {
      ingredientId: parsed.ingredientId,
      quantity: parsed.quantity ?? null,
      unitId: parsed.unitId ?? null,
      notes: parsed.notes ?? null,
      expiresAt: parsed.expiresAt ?? null,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "pantry_item.updated",
    targetType: "household_pantry_item",
    targetId: item.id,
    details: { ingredientId: item.ingredientId },
  });

  return item;
}

export async function deletePantryItem(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  pantryItemId: string;
}) {
  const existing = await prisma.householdPantryItem.findFirst({
    where: { id: params.pantryItemId, organizationId: params.organizationId },
  });
  if (!existing) throw new Error("Pantry item not found.");
  await prisma.householdPantryItem.delete({ where: { id: existing.id } });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "pantry_item.deleted",
    targetType: "household_pantry_item",
    targetId: existing.id,
    details: { ingredientId: existing.ingredientId },
  });
}

export function findAvoidedIngredientMatches(
  recipeIngredients: Array<{ ingredient: { id: string; name: string; canonicalName?: string } }>,
  avoidedIngredients: Array<{ ingredientId: string | null; ingredientName: string; severity: string }>,
) {
  const normalizedAvoided = avoidedIngredients.map((item) => ({
    ...item,
    normalizedName: item.ingredientName.toLowerCase().trim(),
  }));

  return recipeIngredients.flatMap((recipeIngredient) =>
    normalizedAvoided.filter((avoided) => {
      if (avoided.ingredientId && avoided.ingredientId === recipeIngredient.ingredient.id) return true;
      const ingredientName = recipeIngredient.ingredient.name.toLowerCase();
      const canonicalName = recipeIngredient.ingredient.canonicalName?.toLowerCase() ?? ingredientName;
      return ingredientName === avoided.normalizedName || canonicalName === avoided.normalizedName;
    }),
  );
}
