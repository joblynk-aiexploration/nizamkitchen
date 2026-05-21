import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent } = vi.hoisted(() => ({
  createAuditEvent: vi.fn(),
  mockPrisma: {
    dishTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    menuTemplate: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mealPlan: { create: vi.fn() },
    menu: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));

import {
  applyMenuTemplateToMealPlan,
  applyMenuTemplateToSellerMenu,
  archiveMenuTemplate,
  cloneDishTemplate,
  listAvailableMenuTemplates,
  upsertDishTemplate,
  upsertMenuTemplate,
} from "@/server/templates";

function ownerSession() {
  return { user: { id: "owner-1", email: "owner@example.test", status: "active", platformRole: "platform_owner" } } as never;
}

function householdTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "template-1",
    name: "Weekly Hyderabadi Family Meal Plan",
    countryCode: "US",
    region: null,
    city: null,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    items: [
      {
        id: "item-1",
        recipeId: "recipe-1",
        nameSnapshot: "Chicken Dum Biryani",
        dayOffset: 0,
        mealSlot: "dinner",
        quantity: 4,
        displayOrder: 0,
        dishTemplate: { id: "dish-1", name: "Chicken Dum Biryani", ingredients: [], cuisine: { name: "Hyderabadi" } },
      },
    ],
    ...overrides,
  };
}

describe("dish and menu template library", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createAuditEvent.mockResolvedValue({ id: "audit-1" });
  });

  it("platform owner creates a dish template with ingredient and unit mappings", async () => {
    mockPrisma.dishTemplate.create.mockResolvedValue({ id: "dish-1", name: "Chicken Dum Biryani", countryCode: "US", status: "active", city: "Dallas", region: "TX" });

    await upsertDishTemplate(ownerSession(), {
      name: "Chicken Dum Biryani",
      category: "biryani",
      countryCode: "us",
      region: "tx",
      city: "Dallas",
      currencyCode: "usd",
      status: "active",
      visibility: "seller_available",
      ingredientsText: "Basmati Rice | 2 | unit-cup | soaked\nChicken | 1 | unit-kg | bone-in",
      stepsText: "Marinate | Marinate chicken overnight | 60",
    });

    expect(mockPrisma.dishTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Chicken Dum Biryani",
          countryCode: "US",
          region: "TX",
          currencyCode: "USD",
          ingredients: {
            create: expect.arrayContaining([
              expect.objectContaining({ ingredientName: "Basmati Rice", quantity: 2, unitId: "unit-cup" }),
            ]),
          },
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "dish_template.created" }));
  });

  it("platform owner creates a weekly menu template", async () => {
    mockPrisma.menuTemplate.create.mockResolvedValue({ id: "menu-template-1", name: "Weekly Hyderabadi Family Meal Plan", countryCode: "US", status: "active", templateType: "weekly" });

    await upsertMenuTemplate(ownerSession(), {
      name: "Weekly Hyderabadi Family Meal Plan",
      templateType: "weekly",
      countryCode: "US",
      householdUseEnabled: true,
      sellerUseEnabled: false,
      status: "active",
      visibility: "household_available",
      itemsText: "Chicken Dum Biryani | 4 | dinner | biryani | 0 | USD | dish-1 | recipe-1",
    });

    expect(mockPrisma.menuTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateType: "weekly",
          householdUseEnabled: true,
          items: {
            create: [expect.objectContaining({ nameSnapshot: "Chicken Dum Biryani", dayOffset: 4, mealSlot: "dinner", dishTemplateId: "dish-1" })],
          },
        }),
      }),
    );
  });

  it("city-specific templates sort ahead of region, country, and global templates", async () => {
    const globalTemplate = householdTemplate({ id: "global", name: "Global", countryCode: null, region: null, city: null, createdAt: new Date("2026-05-04T00:00:00.000Z") });
    const countryTemplate = householdTemplate({ id: "country", name: "Country", countryCode: "US", region: null, city: null, createdAt: new Date("2026-05-03T00:00:00.000Z") });
    const regionTemplate = householdTemplate({ id: "region", name: "Region", countryCode: "US", region: "TX", city: null, createdAt: new Date("2026-05-02T00:00:00.000Z") });
    const cityTemplate = householdTemplate({ id: "city", name: "City", countryCode: "US", region: "TX", city: "Dallas", createdAt: new Date("2026-05-01T00:00:00.000Z") });
    mockPrisma.menuTemplate.findMany.mockResolvedValue([globalTemplate, countryTemplate, regionTemplate, cityTemplate]);

    const templates = await listAvailableMenuTemplates({ usage: "household", countryCode: "US", region: "TX", city: "Dallas" });

    expect(templates.map((template) => template.id)).toEqual(["city", "region", "country", "global"]);
  });

  it("household can create a meal plan from a template", async () => {
    mockPrisma.menuTemplate.findFirst.mockResolvedValue(householdTemplate());
    mockPrisma.mealPlan.create.mockResolvedValue({ id: "plan-1" });

    await applyMenuTemplateToMealPlan({
      templateId: "template-1",
      organizationId: "household-org",
      countryCode: "US",
      actorUserId: "user-1",
      householdSize: 4,
      startDate: "2026-06-01",
    });

    expect(mockPrisma.mealPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "household-org",
          name: "Weekly Hyderabadi Family Meal Plan",
          days: expect.objectContaining({ create: expect.any(Array) }),
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "menu_template.applied_to_meal_plan" }));
  });

  it("seller can create an editable draft menu from a template", async () => {
    mockPrisma.menuTemplate.findFirst.mockResolvedValue(
      householdTemplate({
        sellerUseEnabled: true,
        items: [
          {
            id: "item-1",
            nameSnapshot: "Chicken Dum Biryani Tray",
            category: "catering_tray",
            priceAmount: 85,
            currencyCode: "USD",
            displayOrder: 0,
            dishTemplate: {
              name: "Chicken Dum Biryani",
              description: "Layered dum biryani",
              category: "biryani",
              defaultServings: 6,
              defaultPriceAmount: 85,
              currencyCode: "USD",
              spiceLevel: "hot",
              cuisine: { name: "Hyderabadi" },
              ingredients: [{ ingredientName: "Basmati Rice" }, { ingredientName: "Chicken" }],
            },
          },
        ],
      }),
    );
    mockPrisma.menu.create.mockResolvedValue({ id: "menu-1" });

    await applyMenuTemplateToSellerMenu({
      templateId: "template-1",
      organizationId: "seller-org",
      countryCode: "US",
      currencyCode: "USD",
      actorUserId: "seller-1",
      sellerType: "home_catering",
    });

    expect(mockPrisma.menu.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "draft",
          visibility: "private",
          items: {
            create: [
              expect.objectContaining({
                name: "Chicken Dum Biryani Tray",
                category: "catering_tray",
                ingredientsSummary: "Basmati Rice, Chicken",
                preorderRequired: true,
              }),
            ],
          },
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "menu_template.applied_to_seller_menu" }));
  });

  it("archived and disabled templates are not selectable", async () => {
    mockPrisma.menuTemplate.findMany.mockResolvedValue([]);

    await listAvailableMenuTemplates({ usage: "seller", sellerType: "restaurant", countryCode: "US" });

    expect(mockPrisma.menuTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
          sellerUseEnabled: true,
        }),
      }),
    );
  });

  it("non-admin users cannot manage templates", async () => {
    await expect(
      upsertMenuTemplate({ user: { id: "user-1", platformRole: null } } as never, {
        name: "Blocked",
        templateType: "daily",
      }),
    ).rejects.toThrow("Platform role is required.");
  });

  it("template clone creates an editable draft copy", async () => {
    mockPrisma.dishTemplate.findUnique.mockResolvedValue({
      id: "dish-1",
      name: "Khatti Dal",
      slug: "khatti-dal",
      description: "Tangy dal",
      cuisineId: "cuisine-1",
      countryCode: "US",
      region: null,
      city: null,
      mealType: "lunch",
      category: "curry",
      defaultServings: 4,
      defaultPriceAmount: 24,
      currencyCode: "USD",
      spiceLevel: "medium",
      visibility: "seller_available",
      ingredients: [{ ingredientName: "Toor Dal", quantity: 200, unitId: "unit-gram", preparationNote: null, displayOrder: 0 }],
      steps: [{ stepNumber: 1, title: "Cook", instruction: "Cook dal", durationMinutes: 20, displayOrder: 0 }],
      menuTemplateItems: [],
    });
    mockPrisma.dishTemplate.create.mockResolvedValue({ id: "dish-copy" });

    await cloneDishTemplate(ownerSession(), "dish-1");

    expect(mockPrisma.dishTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Khatti Dal Copy",
          status: "draft",
          ingredients: { create: [expect.objectContaining({ unitId: "unit-gram" })] },
        }),
      }),
    );
  });

  it("archive action records an audit trail", async () => {
    mockPrisma.menuTemplate.update.mockResolvedValue({ id: "template-1", name: "Old Template", countryCode: "US" });

    await archiveMenuTemplate(ownerSession(), "template-1");

    expect(mockPrisma.menuTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "archived" }) }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "menu_template.archived" }));
  });
});
