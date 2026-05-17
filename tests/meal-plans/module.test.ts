import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent, generateGroceryList, isFeatureEnabled } = vi.hoisted(() => ({
  mockPrisma: {
    mealPlan: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    mealPlanDay: {
      findFirst: vi.fn(),
    },
    mealPlanEntry: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    mealPlanPreference: {
      upsert: vi.fn(),
    },
    recipe: {
      findFirst: vi.fn(),
    },
  },
  createAuditEvent: vi.fn(),
  generateGroceryList: vi.fn(),
  isFeatureEnabled: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/server/audit", () => ({
  createAuditEvent,
}));

vi.mock("@/server/grocery", () => ({
  generateGroceryList,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled,
}));

import {
  addMealPlanEntry,
  canAccessMealPlanner,
  createMealPlan,
  generateGroceryListFromMealPlan,
  updateMealPlanEntry,
  updateMealPlanPreference,
} from "../../src/server/meal-plans";
import { mealPlanCreateSchema } from "../../src/lib/validation/meal-plans";

describe("meal planner server flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a meal plan with generated days and an audit log", async () => {
    mockPrisma.mealPlan.create.mockResolvedValue({ id: "plan-1" });

    await createMealPlan({
      organizationId: "org-1",
      countryCode: "US",
      createdById: "user-1",
      input: {
        name: "Week One",
        startDate: "2026-05-18",
        endDate: "2026-05-24",
        householdSize: 4,
      },
    });

    expect(mockPrisma.mealPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          countryCode: "US",
          householdSize: 4,
          days: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ dayLabel: "Monday" }),
              expect.objectContaining({ dayLabel: "Sunday" }),
            ]),
          }),
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meal_plan.created", targetId: "plan-1" }),
    );
  });

  it("adds a recipe-backed meal plan entry", async () => {
    mockPrisma.mealPlanDay.findFirst.mockResolvedValue({
      id: "cday1001",
      mealPlan: { id: "plan-1", countryCode: "US" },
      entries: [],
    });
    mockPrisma.recipe.findFirst.mockResolvedValue({ id: "crecipe01" });
    mockPrisma.mealPlanEntry.create.mockResolvedValue({
      id: "entry-1",
      recipeId: "recipe-1",
      customMealName: null,
      mealType: "dinner",
      targetServings: 6,
    });

    await addMealPlanEntry({
      organizationId: "org-1",
      actorUserId: "user-1",
      input: {
        mealPlanDayId: "cday1001",
        recipeId: "crecipe01",
        mealType: "dinner",
        targetServings: 6,
      },
    });

    expect(mockPrisma.mealPlanEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipeId: "crecipe01",
          customMealName: null,
          targetServings: 6,
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meal_plan_entry.created" }),
    );
  });

  it("adds a custom meal entry without forcing a recipe", async () => {
    mockPrisma.mealPlanDay.findFirst.mockResolvedValue({
      id: "cday2002",
      mealPlan: { id: "plan-1", countryCode: "US" },
      entries: [],
    });
    mockPrisma.mealPlanEntry.create.mockResolvedValue({
      id: "entry-2",
      recipeId: null,
      customMealName: "Leftovers",
      mealType: "lunch",
      targetServings: 3,
    });

    await addMealPlanEntry({
      organizationId: "org-1",
      actorUserId: "user-1",
      input: {
        mealPlanDayId: "cday2002",
        customMealName: "Leftovers",
        mealType: "lunch",
        targetServings: 3,
      },
    });

    expect(mockPrisma.mealPlanEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipeId: null,
          customMealName: "Leftovers",
        }),
      }),
    );
  });

  it("updates target servings on an entry", async () => {
    mockPrisma.mealPlanEntry.findFirst.mockResolvedValue({
      id: "entry-3",
      recipeId: "recipe-1",
      customMealName: null,
      mealPlanDayId: "cday1001",
      mealPlanDay: {
        mealPlan: { countryCode: "US" },
        entries: [],
      },
    });
    mockPrisma.recipe.findFirst.mockResolvedValue({ id: "recipe-1" });
    mockPrisma.mealPlanEntry.update.mockResolvedValue({ id: "entry-3", targetServings: 8 });

    await updateMealPlanEntry({
      entryId: "entry-3",
      organizationId: "org-1",
      actorUserId: "user-1",
      input: { targetServings: 8 },
    });

    expect(mockPrisma.mealPlanEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entry-3" },
        data: expect.objectContaining({ targetServings: 8 }),
      }),
    );
  });

  it("generates a grocery list from recipe meals and ignores custom meals", async () => {
    mockPrisma.mealPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      organizationId: "org-1",
      countryCode: "US",
      name: "Family Week",
      notes: "Use pantry first",
      householdSize: 5,
      startDate: new Date("2026-05-18T00:00:00.000Z"),
      endDate: new Date("2026-05-24T00:00:00.000Z"),
      days: [
        {
          date: new Date("2026-05-18T00:00:00.000Z"),
          entries: [
            { id: "entry-1", recipeId: "recipe-1", mealType: "dinner", targetServings: 5, status: "planned" },
            { id: "entry-2", recipeId: null, customMealName: "Takeout", mealType: "lunch", targetServings: 3 },
          ],
        },
      ],
    });
    generateGroceryList.mockResolvedValue({ id: "gro-1", name: "Family Week Grocery List" });

    await generateGroceryListFromMealPlan({
      organizationId: "org-1",
      mealPlanId: "plan-1",
      createdById: "user-1",
    });

    expect(generateGroceryList).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "meal_plan",
        mealPlanId: "plan-1",
        input: expect.objectContaining({
          recipes: [
            expect.objectContaining({
              recipeId: "recipe-1",
              targetServings: 5,
              mealSlot: "dinner",
            }),
          ],
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meal_plan.grocery_list_generated", targetId: "plan-1" }),
    );
  });

  it("prevents cross-tenant day access when adding an entry", async () => {
    mockPrisma.mealPlanDay.findFirst.mockResolvedValue(null);

    await expect(
      addMealPlanEntry({
        organizationId: "org-1",
        actorUserId: "user-1",
        input: {
          mealPlanDayId: "cday9999",
          customMealName: "Soup",
          mealType: "dinner",
          targetServings: 2,
        },
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("applies feature flag behavior with platform admin bypass", async () => {
    isFeatureEnabled.mockResolvedValue(false);

    await expect(
      canAccessMealPlanner({ organizationId: "org-1", platformRole: null }),
    ).resolves.toBe(false);

    await expect(
      canAccessMealPlanner({ organizationId: "org-1", platformRole: "platform_admin" }),
    ).resolves.toBe(true);
  });

  it("validates meal plan date ranges", () => {
    expect(() =>
      mealPlanCreateSchema.parse({
        name: "Invalid plan",
        startDate: "2026-05-24",
        endDate: "2026-05-18",
        householdSize: 4,
      }),
    ).toThrow(/end date/i);
  });

  it("updates meal preferences", async () => {
    mockPrisma.mealPlanPreference.upsert.mockResolvedValue({ id: "pref-1" });

    await updateMealPlanPreference({
      organizationId: "org-1",
      actorUserId: "user-1",
      countryCode: "US",
      input: {
        defaultHouseholdSize: 5,
        preferredCuisines: ["Hyderabadi", "Indian"],
        avoidedIngredients: ["Peanuts"],
        spicePreference: "medium",
        dietaryNotes: "Weekday friendly",
        weeklyCookingDays: ["monday", "wednesday"],
        measurementSystem: "imperial",
      },
    });

    expect(mockPrisma.mealPlanPreference.upsert).toHaveBeenCalled();
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meal_preferences.updated", targetId: "pref-1" }),
    );
  });
});
