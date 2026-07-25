import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent, isFeatureEnabled, sendTemplateEmail } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    membership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    recipe: {
      findMany: vi.fn(),
    },
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
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
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
  sendTemplateEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hashed-password") }));
vi.mock("@/server/email/email-service", () => ({ sendTemplateEmail }));

import {
  addAvoidedIngredient,
  addFavoriteRecipe,
  canAccessFamilyProfiles,
  createHouseholdMemberAccount,
  deleteAvoidedIngredient,
  findAvoidedIngredientMatches,
  isHouseholdOrganization,
  listHouseholdMembers,
  listHouseholdSharedRecipes,
  removeFavoriteRecipe,
  upsertShoppingPreference,
  updatePantryItem,
  upsertHouseholdProfile,
} from "../../src/server/household";

describe("household profiles and preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendTemplateEmail.mockResolvedValue({ sent: true, logId: "email-log-1", reason: null });
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
    mockPrisma.favoriteRecipe.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "fav-1", recipeId: "recipe-1" });
    mockPrisma.favoriteRecipe.create.mockResolvedValue({ id: "fav-1", recipeId: "recipe-1" });
    mockPrisma.favoriteRecipe.deleteMany.mockResolvedValue({ count: 1 });

    await addFavoriteRecipe({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: { recipeId: "recipe-1", targetServings: 6 },
    });
    await removeFavoriteRecipe({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      recipeId: "recipe-1",
    });

    expect(mockPrisma.favoriteRecipe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          recipeId: "recipe-1",
          createdById: "user-1",
          recipientUserId: null,
          targetServings: 6,
        }),
      }),
    );
    expect(mockPrisma.favoriteRecipe.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", recipeId: "recipe-1" },
    });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "favorite_recipe.created" }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "favorite_recipe.deleted" }));
  });

  it("shares a favorite recipe with a specific active household member", async () => {
    mockPrisma.membership.findUnique.mockResolvedValue({ status: "active" });
    mockPrisma.favoriteRecipe.findFirst.mockResolvedValue(null);
    mockPrisma.favoriteRecipe.create.mockResolvedValue({ id: "fav-member-1", recipeId: "recipe-1", recipientUserId: "member-2" });

    await addFavoriteRecipe({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: { recipeId: "recipe-1", recipientUserId: "member-2", targetServings: 4 },
    });

    expect(mockPrisma.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: "member-2", organizationId: "org-1" } },
      select: { status: true },
    });
    expect(mockPrisma.favoriteRecipe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          recipeId: "recipe-1",
          recipientUserId: "member-2",
          targetServings: 4,
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ shareScope: "member", recipientUserId: "member-2" }),
      }),
    );
  });

  it("rejects recipe shares to users outside the active household", async () => {
    mockPrisma.membership.findUnique.mockResolvedValue({ status: "disabled" });

    await expect(
      addFavoriteRecipe({
        organizationId: "org-1",
        actorUserId: "user-1",
        countryCode: "US",
        input: { recipeId: "recipe-1", recipientUserId: "member-2" },
      }),
    ).rejects.toThrow("Choose an active family member from this household.");
    expect(mockPrisma.favoriteRecipe.create).not.toHaveBeenCalled();
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

  it("creates a family member account and active household membership", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "daughter-1",
      fullName: "Ayesha Nizam",
      email: "ayesha@example.com",
    });
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    mockPrisma.membership.upsert.mockResolvedValue({
      id: "membership-1",
      userId: "daughter-1",
      organizationId: "org-1",
      role: "household_member",
      status: "active",
    });

    await createHouseholdMemberAccount({
      organizationId: "org-1",
      organizationName: "Nizam Family Kitchen",
      actorUserId: "parent-1",
      actorRole: "org_owner",
      countryCode: "US",
      input: {
        fullName: "Ayesha Nizam",
        email: "Ayesha@Example.com",
        password: "FamilyMemberAccess123",
      },
    });

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        fullName: "Ayesha Nizam",
        email: "ayesha@example.com",
        passwordHash: "hashed-password",
      },
    });
    expect(mockPrisma.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "daughter-1",
          organizationId: "org-1",
          role: "household_member",
          status: "active",
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "household_member.created" }));
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ayesha@example.com",
        recipientUserId: "daughter-1",
        organizationId: "org-1",
        countryCode: "US",
        templateKey: "auth.welcome",
        variables: expect.objectContaining({
          appName: "NizamKitchen",
          userName: "Ayesha Nizam",
          userEmail: "ayesha@example.com",
          organizationName: "Nizam Family Kitchen",
          dashboardUrl: expect.stringMatching(/\/dashboard$/),
          primaryActionLabel: "Open household dashboard",
        }),
        metadata: expect.objectContaining({
          source: "household_member_created",
          membershipId: "membership-1",
          createdByUserId: "parent-1",
          existingUser: false,
        }),
        idempotencyKey: "household-member-welcome:membership-1:daughter-1",
      }),
    );
  });

  it("does not roll back family member creation when welcome email delivery fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendTemplateEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "daughter-2",
      fullName: "Sameera Nizam",
      email: "sameera@example.com",
    });
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    mockPrisma.membership.upsert.mockResolvedValue({
      id: "membership-2",
      userId: "daughter-2",
      organizationId: "org-1",
      role: "household_member",
      status: "active",
    });

    try {
      await expect(
        createHouseholdMemberAccount({
          organizationId: "org-1",
          organizationName: "Nizam Family Kitchen",
          actorUserId: "parent-1",
          actorRole: "org_owner",
          countryCode: "US",
          input: {
            fullName: "Sameera Nizam",
            email: "Sameera@Example.com",
            password: "FamilyMemberAccess123",
          },
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          user: expect.objectContaining({ id: "daughter-2" }),
          membership: expect.objectContaining({ id: "membership-2" }),
        }),
      );

      expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "household_member.created" }));
      expect(consoleError).toHaveBeenCalledWith("Unable to send household member welcome email", expect.any(Error));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("blocks regular household members from creating more family logins", async () => {
    await expect(
      createHouseholdMemberAccount({
        organizationId: "org-1",
        actorUserId: "member-1",
        actorRole: "household_member",
        countryCode: "US",
        input: {
          fullName: "Ayesha Nizam",
          email: "ayesha@example.com",
          password: "FamilyMemberAccess123",
        },
      }),
    ).rejects.toThrow("Only household owners and admins can create family member accounts.");
  });

  it("lists active household members and household-shared recipes", async () => {
    mockPrisma.membership.findMany.mockResolvedValue([{ id: "membership-1" }]);
    mockPrisma.favoriteRecipe.findMany.mockResolvedValue([{ id: "favorite-1", recipe: { id: "recipe-1" }, targetServings: 6 }]);

    await expect(listHouseholdMembers("org-1")).resolves.toEqual([{ id: "membership-1" }]);
    await expect(listHouseholdSharedRecipes("org-1")).resolves.toEqual([{ id: "favorite-1", recipe: { id: "recipe-1" }, targetServings: 6 }]);

    expect(mockPrisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1", status: "active" } }),
    );
    expect(mockPrisma.favoriteRecipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1" } }),
    );
  });
});
