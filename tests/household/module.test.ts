import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent, isFeatureEnabled } = vi.hoisted(() => ({
  mockPrisma: {
    householdProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    householdPreferredCuisine: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    householdShoppingPreference: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    mealPlanPreference: {
      upsert: vi.fn(),
    },
    avoidedIngredient: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    favoriteRecipe: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    householdPantryItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
  createAuditEvent: vi.fn(),
  isFeatureEnabled: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled }));

import {
  addAvoidedIngredient,
  addFavoriteRecipe,
  canAccessFamilyProfiles,
  deleteAvoidedIngredient,
  findAvoidedIngredientMatches,
  isHouseholdOrganization,
  removeFavoriteRecipe,
  upsertShoppingPreference,
  updatePantryItem,
  upsertHouseholdProfile,
} from "../../src/server/household";

describe("household profiles and preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a household profile and syncs meal planner defaults", async () => {
    mockPrisma.householdProfile.findUnique.mockResolvedValue(null);
    mockPrisma.householdProfile.upsert.mockResolvedValue({ id: "profile-1" });
    mockPrisma.mealPlanPreference.upsert.mockResolvedValue({ id: "meal-pref-1" });
    mockPrisma.householdPreferredCuisine.deleteMany.mockReturnValue(Promise.resolve({ count: 0 }));
    mockPrisma.householdPreferredCuisine.upsert.mockReturnValue(Promise.resolve({ id: "pref-cuisine-1" }));

    await upsertHouseholdProfile({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: {
        displayName: "Nizam Family",
        countryCode: "US",
        defaultHouseholdSize: 5,
        adultsCount: 2,
        childrenCount: 3,
        defaultServings: 6,
        defaultSpiceLevel: "medium",
        preferredMeasurementSystem: "imperial",
        preferredCuisineIds: ["cuisine-1"],
        cookingSkillLevel: "intermediate",
        weeklyCookingDays: ["monday", "wednesday"],
      },
    });

    expect(mockPrisma.householdProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        create: expect.objectContaining({ organizationId: "org-1", defaultServings: 6 }),
      }),
    );
    expect(mockPrisma.mealPlanPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        update: expect.objectContaining({ defaultHouseholdSize: 5, spicePreference: "medium" }),
      }),
    );
    expect(mockPrisma.householdPreferredCuisine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_cuisineId: { organizationId: "org-1", cuisineId: "cuisine-1" } },
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "household_profile.created" }));
  });

  it("updates a household profile with an updated audit event", async () => {
    mockPrisma.householdProfile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.householdProfile.upsert.mockResolvedValue({ id: "profile-1" });
    mockPrisma.mealPlanPreference.upsert.mockResolvedValue({ id: "meal-pref-1" });
    mockPrisma.householdPreferredCuisine.deleteMany.mockReturnValue(Promise.resolve({ count: 0 }));

    await upsertHouseholdProfile({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: {
        displayName: "Nizam Family Updated",
        countryCode: "US",
        defaultHouseholdSize: 4,
        defaultServings: 4,
        defaultSpiceLevel: "mild",
        preferredMeasurementSystem: "mixed",
        preferredCuisineIds: [],
        cookingSkillLevel: "advanced",
        weeklyCookingDays: [],
      },
    });

    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "household_profile.updated" }));
  });

  it("scopes avoided ingredient deletion by organization", async () => {
    mockPrisma.avoidedIngredient.findFirst.mockResolvedValue({
      id: "avoid-1",
      organizationId: "org-1",
      ingredientName: "Mutton",
    });
    mockPrisma.avoidedIngredient.delete.mockResolvedValue({ id: "avoid-1" });

    await deleteAvoidedIngredient({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      avoidedIngredientId: "avoid-1",
    });

    expect(mockPrisma.avoidedIngredient.findFirst).toHaveBeenCalledWith({
      where: { id: "avoid-1", organizationId: "org-1" },
    });
  });

  it("adds and removes organization-scoped favorite recipes", async () => {
    mockPrisma.favoriteRecipe.upsert.mockResolvedValue({ id: "fav-1", recipeId: "recipe-1" });
    mockPrisma.favoriteRecipe.findUnique.mockResolvedValue({ id: "fav-1", recipeId: "recipe-1" });
    mockPrisma.favoriteRecipe.delete.mockResolvedValue({ id: "fav-1" });

    await addFavoriteRecipe({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: { recipeId: "recipe-1" },
    });
    await removeFavoriteRecipe({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      recipeId: "recipe-1",
    });

    expect(mockPrisma.favoriteRecipe.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_recipeId: { organizationId: "org-1", recipeId: "recipe-1" } },
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "favorite_recipe.created" }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "favorite_recipe.deleted" }));
  });

  it("detects avoided ingredient warnings on recipe details", () => {
    const matches = findAvoidedIngredientMatches(
      [{ ingredient: { id: "ing-1", name: "Mutton", canonicalName: "Mutton" } }],
      [{ ingredientId: null, ingredientName: "mutton", severity: "strict" }],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].ingredientName).toBe("mutton");
  });

  it("returns false for non-household organization behavior", () => {
    expect(isHouseholdOrganization("chef_business")).toBe(false);
    expect(isHouseholdOrganization("household")).toBe(true);
  });

  it("uses feature flag for regular organizations and lets platform admins bypass", async () => {
    isFeatureEnabled.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(canAccessFamilyProfiles({ organizationId: "org-1", platformRole: null })).resolves.toBe(false);
    await expect(canAccessFamilyProfiles({ organizationId: "org-1", platformRole: null })).resolves.toBe(true);
    await expect(canAccessFamilyProfiles({ organizationId: "org-1", platformRole: "platform_admin" })).resolves.toBe(true);
  });

  it("creates avoided ingredients with audit logs", async () => {
    mockPrisma.avoidedIngredient.create.mockResolvedValue({
      id: "avoid-2",
      ingredientName: "Peanuts",
      severity: "avoid",
    });

    await addAvoidedIngredient({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: { ingredientName: "Peanuts", severity: "avoid" },
    });

    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "avoided_ingredient.created" }));
  });

  it("updates pantry items with tenant scope and audit logs", async () => {
    mockPrisma.householdPantryItem.findFirst.mockResolvedValue({
      id: "pantry-1",
      organizationId: "org-1",
      ingredientId: "ingredient-1",
    });
    mockPrisma.householdPantryItem.update.mockResolvedValue({
      id: "pantry-1",
      ingredientId: "ingredient-2",
    });

    await updatePantryItem({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      pantryItemId: "pantry-1",
      input: { ingredientId: "ingredient-2", quantity: "2", unitId: null, notes: "fresh" },
    });

    expect(mockPrisma.householdPantryItem.findFirst).toHaveBeenCalledWith({
      where: { id: "pantry-1", organizationId: "org-1" },
    });
    expect(mockPrisma.householdPantryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pantry-1" },
        data: expect.objectContaining({ ingredientId: "ingredient-2", quantity: 2 }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "pantry_item.updated" }));
  });

  it("updates shopping preferences with audit logs", async () => {
    mockPrisma.householdShoppingPreference.upsert.mockResolvedValue({
      id: "shopping-1",
      preferredShoppingDay: "saturday",
      preferredDeliveryMethod: "pickup",
    });

    await upsertShoppingPreference({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: {
        preferredStoreName: "Local halal market",
        preferredShoppingDay: "saturday",
        preferredDeliveryMethod: "pickup",
        notes: "Prefer curbside pickup.",
      },
    });

    expect(mockPrisma.householdShoppingPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        create: expect.objectContaining({ organizationId: "org-1", preferredDeliveryMethod: "pickup" }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "shopping_preference.updated" }));
  });
});
