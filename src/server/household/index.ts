import { Prisma, type MeasurementSystem, type OrganizationRole, type PlatformRole, type SpiceLevel } from "@prisma/client";
import { hasPlatformRole, PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import {
  avoidedIngredientCreateSchema,
  favoriteRecipeSchema,
  householdMemberAccountSchema,
  householdProfileSchema,
  pantryItemSchema,
  shoppingPreferenceSchema,
} from "@/lib/validation/household";
import { createAuditEvent } from "@/server/audit";
import { sendTemplateEmail } from "@/server/email/email-service";

const householdProfileInclude = Prisma.validator<Prisma.HouseholdProfileDefaultArgs>()({
  include: {
    organization: { select: { id: true, name: true, organizationType: true, countryCode: true } },
  },
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
  const [profile, avoidedIngredients, favorites, pantryItems, preferredCuisines, shoppingPreference, members] = await Promise.all([
    getHouseholdProfile(organizationId),
    listAvoidedIngredients(organizationId),
    listFavoriteRecipes(organizationId),
    listPantryItems(organizationId),
    listPreferredCuisines(organizationId),
    getShoppingPreference(organizationId),
    listHouseholdMembers(organizationId),
  ]);

  return { profile, avoidedIngredients, favorites, pantryItems, preferredCuisines, shoppingPreference, members };
}

export async function listPreferredCuisines(organizationId: string) {
  return prisma.householdPreferredCuisine.findMany({
    where: { organizationId },
    include: { cuisine: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listHouseholdMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId, status: "active" },
    include: { user: { select: { id: true, fullName: true, email: true, status: true, profilePhotoFileId: true } } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function listHouseholdSharedRecipes(organizationId: string) {
  return prisma.favoriteRecipe.findMany({
    where: { organizationId },
    include: {
      recipe: { include: { cuisine: true } },
      createdBy: { select: { fullName: true } },
      recipientUser: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
}

export async function createHouseholdMemberAccount(params: {
  organizationId: string;
  organizationName?: string | null;
  actorUserId: string;
  actorRole: OrganizationRole;
  countryCode: string;
  input: unknown;
}) {
  if (!["org_owner", "org_admin"].includes(params.actorRole)) {
    throw new Error("Only household owners and admins can create family member accounts.");
  }

  const parsed = householdMemberAccountSchema.parse(params.input);
  const passwordHash = await hashPassword(parsed.password);
  const existingUser = await prisma.user.findUnique({ where: { email: parsed.email } });
  const user = existingUser ?? (await prisma.user.create({
    data: {
      fullName: parsed.fullName,
      email: parsed.email,
      passwordHash,
    },
  }));

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: params.organizationId } },
  });
  if (existingMembership?.status === "active") {
    throw new Error("That family member already has access to this household.");
  }

  const membership = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: params.organizationId } },
    update: {
      role: "household_member",
      status: "active",
    },
    create: {
      userId: user.id,
      organizationId: params.organizationId,
      role: "household_member",
      status: "active",
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "household_member.created",
    targetType: "membership",
    targetId: membership.id,
    details: {
      userId: user.id,
      email: user.email,
      existingUser: Boolean(existingUser),
    },
  });

  await sendHouseholdMemberWelcomeEmail({
    user,
    membershipId: membership.id,
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    countryCode: params.countryCode,
    actorUserId: params.actorUserId,
    existingUser: Boolean(existingUser),
  });

  return { user, membership, existingUser: Boolean(existingUser) };
}

async function sendHouseholdMemberWelcomeEmail(params: {
  user: { id: string; fullName: string; email: string };
  membershipId: string;
  organizationId: string;
  organizationName?: string | null;
  countryCode: string;
  actorUserId: string;
  existingUser: boolean;
}) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const dashboardUrl = new URL("/dashboard", appUrl).toString();

  try {
    await sendTemplateEmail({
      to: params.user.email,
      recipientUserId: params.user.id,
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      templateKey: "auth.welcome",
      variables: {
        appName: "NizamKitchen",
        userName: params.user.fullName,
        userEmail: params.user.email,
        organizationName: params.organizationName || "your household",
        dashboardUrl,
        appUrl,
        currentYear: new Date().getFullYear(),
        primaryActionLabel: "Open household dashboard",
      },
      metadata: {
        source: "household_member_created",
        membershipId: params.membershipId,
        createdByUserId: params.actorUserId,
        existingUser: params.existingUser,
      },
      idempotencyKey: `household-member-welcome:${params.membershipId}:${params.user.id}`,
    });
  } catch (error) {
    console.error("Unable to send household member welcome email", error);
  }
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
  await syncPreferredCuisines(params.organizationId, parsed.preferredCuisineIds);

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

async function syncPreferredCuisines(organizationId: string, cuisineIds: string[]) {
  await prisma.$transaction([
    prisma.householdPreferredCuisine.deleteMany({
      where: { organizationId, cuisineId: { notIn: cuisineIds } },
    }),
    ...cuisineIds.map((cuisineId) =>
      prisma.householdPreferredCuisine.upsert({
        where: { organizationId_cuisineId: { organizationId, cuisineId } },
        update: {},
        create: { organizationId, cuisineId },
      }),
    ),
  ]);
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
    include: {
      recipe: { include: { cuisine: true } },
      createdBy: { select: { fullName: true } },
      recipientUser: { select: { id: true, fullName: true, email: true } },
    },
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
  const recipientUserId = parsed.recipientUserId ?? null;

  if (recipientUserId) {
    const recipientMembership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: recipientUserId, organizationId: params.organizationId } },
      select: { status: true },
    });
    if (recipientMembership?.status !== "active") {
      throw new Error("Choose an active family member from this household.");
    }
  }

  const existing = await prisma.favoriteRecipe.findFirst({
    where: {
      organizationId: params.organizationId,
      recipeId: parsed.recipeId,
      recipientUserId,
    },
  });
  const favorite = existing
    ? await prisma.favoriteRecipe.update({
      where: { id: existing.id },
      data: {
        targetServings: parsed.targetServings ?? undefined,
      },
    })
    : await prisma.favoriteRecipe.create({
      data: {
        organizationId: params.organizationId,
        recipeId: parsed.recipeId,
        createdById: params.actorUserId,
        recipientUserId,
        targetServings: parsed.targetServings ?? null,
      },
    });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "favorite_recipe.created",
    targetType: "favorite_recipe",
    targetId: favorite.id,
    details: {
      recipeId: parsed.recipeId,
      targetServings: parsed.targetServings ?? null,
      shareScope: recipientUserId ? "member" : "household",
      recipientUserId,
    },
  });

  return favorite;
}

export async function removeFavoriteRecipe(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  recipeId: string;
}) {
  const existing = await prisma.favoriteRecipe.findFirst({
    where: { organizationId: params.organizationId, recipeId: params.recipeId },
  });
  if (!existing) return;

  await prisma.favoriteRecipe.deleteMany({
    where: { organizationId: params.organizationId, recipeId: params.recipeId },
  });
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

export async function getShoppingPreference(organizationId: string) {
  return prisma.householdShoppingPreference.findUnique({
    where: { organizationId },
  });
}

export async function upsertShoppingPreference(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = shoppingPreferenceSchema.parse(params.input);
  const preference = await prisma.householdShoppingPreference.upsert({
    where: { organizationId: params.organizationId },
    update: {
      preferredStoreName: parsed.preferredStoreName ?? null,
      preferredShoppingDay: parsed.preferredShoppingDay ?? null,
      preferredDeliveryMethod: parsed.preferredDeliveryMethod,
      notes: parsed.notes ?? null,
    },
    create: {
      organizationId: params.organizationId,
      preferredStoreName: parsed.preferredStoreName ?? null,
      preferredShoppingDay: parsed.preferredShoppingDay ?? null,
      preferredDeliveryMethod: parsed.preferredDeliveryMethod,
      notes: parsed.notes ?? null,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "shopping_preference.updated",
    targetType: "household_shopping_preference",
    targetId: preference.id,
    details: {
      preferredShoppingDay: preference.preferredShoppingDay,
      preferredDeliveryMethod: preference.preferredDeliveryMethod,
    },
  });

  return preference;
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
