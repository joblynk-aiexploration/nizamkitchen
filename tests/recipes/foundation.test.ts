import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma, recordAdminAuditLog } = vi.hoisted(() => ({
  mockPrisma: {
    ingredient: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ingredientAlias: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    recipe: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    recipeIngredient: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    recipeStep: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    unit: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    unitConversion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  recordAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit/audit-service", () => ({
  recordAdminAuditLog,
  getAuditSeverity: (action: string) => (action === "access.denied" ? "warning" : "info"),
}));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn(), auditAccessDenied: vi.fn() }));

import { convertUnit, isSafeConversionPossible } from "../../src/lib/units";
import { matchIngredientByAlias } from "../../src/lib/ingredients";
import { isRecipeVisibleToOrganization } from "../../src/lib/recipe-utils";
import { AccessDeniedError } from "../../src/lib/auth";
import { createIngredient } from "../../src/server/ingredients";
import { createRecipe, listRecipes } from "../../src/server/recipes";
import type { Unit, UnitConversion, Ingredient } from "@prisma/client";

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "unit-gram",
    code: "gram",
    name: "gram",
    pluralName: "grams",
    type: "mass",
    system: "metric",
    symbol: "g",
    isBaseUnit: true,
    isGlobal: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: "ing-onion",
    organizationId: null,
    countryCode: null,
    name: "Onion",
    canonicalName: "Onion",
    slug: "onion",
    category: "vegetable",
    defaultUnitId: null,
    densityGramPerMl: null,
    averagePieceWeightGrams: 150,
    isGlobal: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeConversion(overrides: Partial<UnitConversion & { fromUnit: Unit; toUnit: Unit; ingredient: Ingredient | null }> = {}): UnitConversion & { fromUnit: Unit; toUnit: Unit; ingredient: Ingredient | null } {
  const gram = makeUnit();
  const kilogram = makeUnit({ id: "unit-kg", code: "kilogram", name: "kilogram", pluralName: "kilograms", symbol: "kg", isBaseUnit: false });
  return {
    id: "conv-1",
    fromUnitId: "unit-gram",
    toUnitId: "unit-kg",
    ingredientId: null,
    multiplier: 0.001,
    offset: null,
    confidence: 1.0,
    notes: "Exact SI conversion",
    isGlobal: true,
    countryCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    fromUnit: gram,
    toUnit: kilogram,
    ingredient: null,
    ...overrides,
  };
}

function makePlatformAdminSession(overrides?: Partial<{ platformRole: string | null }>) {
  return {
    user: {
      id: "user-admin",
      email: "admin@test.dev",
      status: "active" as const,
      platformRole: (overrides?.platformRole ?? "platform_admin") as never,
    },
    activeMembership: null,
    activeOrganization: null,
    countryAssignments: [],
  };
}

function makeOrgMemberSession(organizationId: string) {
  return {
    user: {
      id: "user-member",
      email: "member@test.dev",
      status: "active" as const,
      platformRole: null,
    },
    activeMembership: {
      organizationId,
      role: "org_owner" as const,
      status: "active" as const,
    },
    activeOrganization: {
      id: organizationId,
      countryCode: "US",
      status: "active" as const,
    },
    countryAssignments: [],
  };
}

// ─── Unit conversion tests ────────────────────────────────────────────────────

describe("unit conversion — exact mass", () => {
  it("converts gram to kilogram exactly", () => {
    const gram = makeUnit();
    const kilogram = makeUnit({ id: "unit-kg", code: "kilogram", name: "kilogram", pluralName: "kilograms", isBaseUnit: false });
    const conv = makeConversion({ multiplier: 0.001, confidence: 1.0 });

    const result = convertUnit({
      quantity: 500,
      fromUnit: gram,
      toUnit: kilogram,
      conversions: [conv],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(0.5, 10);
      expect(result.confidence).toBe(1.0);
    }
  });

  it("converts kilogram to gram exactly", () => {
    const gram = makeUnit();
    const kilogram = makeUnit({ id: "unit-kg", code: "kilogram", name: "kilogram", pluralName: "kilograms", isBaseUnit: false });
    const conv = makeConversion({
      fromUnitId: "unit-kg",
      toUnitId: "unit-gram",
      fromUnit: kilogram,
      toUnit: gram,
      multiplier: 1000,
      confidence: 1.0,
    });

    const result = convertUnit({
      quantity: 1,
      fromUnit: kilogram,
      toUnit: gram,
      conversions: [conv],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(1000);
      expect(result.confidence).toBe(1.0);
    }
  });

  it("returns same quantity when from and to units are identical", () => {
    const gram = makeUnit();
    const result = convertUnit({ quantity: 250, fromUnit: gram, toUnit: gram, conversions: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(250);
      expect(result.confidence).toBe(1.0);
    }
  });
});

describe("unit conversion — exact volume", () => {
  it("converts milliliter to liter exactly", () => {
    const ml = makeUnit({ id: "unit-ml", code: "milliliter", name: "milliliter", pluralName: "milliliters", type: "volume", symbol: "ml", isBaseUnit: true });
    const liter = makeUnit({ id: "unit-l", code: "liter", name: "liter", pluralName: "liters", type: "volume", symbol: "L", isBaseUnit: false });
    const conv = makeConversion({ fromUnitId: "unit-ml", toUnitId: "unit-l", fromUnit: ml, toUnit: liter, multiplier: 0.001, confidence: 1.0 });

    const result = convertUnit({ quantity: 250, fromUnit: ml, toUnit: liter, conversions: [conv] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(0.25, 10);
      expect(result.confidence).toBe(1.0);
    }
  });
});

describe("unit conversion — unsafe piece to gram", () => {
  it("refuses piece-to-gram without ingredient data", () => {
    const piece = makeUnit({ id: "unit-piece", code: "piece", name: "piece", pluralName: "pieces", type: "count", system: "mixed", isBaseUnit: true });
    const gram = makeUnit();

    const result = convertUnit({ quantity: 3, fromUnit: piece, toUnit: gram, conversions: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/without ingredient-specific data/i);
    }
  });

  it("converts piece to gram using ingredient averagePieceWeightGrams", () => {
    const piece = makeUnit({ id: "unit-piece", code: "piece", name: "piece", pluralName: "pieces", type: "count", system: "mixed", isBaseUnit: true });
    const gram = makeUnit();
    const ingredient = makeIngredient({ averagePieceWeightGrams: 150 });

    const result = convertUnit({ quantity: 3, fromUnit: piece, toUnit: gram, conversions: [], ingredient });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(450);
      expect(result.confidence).toBeLessThan(1.0);
    }
  });

  it("converts piece to gram using ingredient-specific conversion record", () => {
    const piece = makeUnit({ id: "unit-piece", code: "piece", name: "piece", pluralName: "pieces", type: "count", system: "mixed", isBaseUnit: true });
    const gram = makeUnit();
    const ingredient = makeIngredient();
    const conv = makeConversion({
      fromUnitId: "unit-piece",
      toUnitId: "unit-gram",
      fromUnit: piece,
      toUnit: gram,
      ingredientId: ingredient.id,
      multiplier: 120,
      confidence: 0.8,
      ingredient,
    });

    const result = convertUnit({ quantity: 2, fromUnit: piece, toUnit: gram, conversions: [conv], ingredient });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(240);
      expect(result.confidence).toBe(0.8);
    }
  });

  it("refuses bunch-to-gram conversion without ingredient data", () => {
    const bunch = makeUnit({ id: "unit-bunch", code: "bunch", name: "bunch", pluralName: "bunches", type: "count", system: "mixed" });
    const gram = makeUnit();

    const result = convertUnit({ quantity: 1, fromUnit: bunch, toUnit: gram, conversions: [] });

    expect(result.ok).toBe(false);
  });
});

describe("isSafeConversionPossible", () => {
  it("allows mass to mass", () => expect(isSafeConversionPossible("mass", "mass")).toBe(true));
  it("allows volume to volume", () => expect(isSafeConversionPossible("volume", "volume")).toBe(true));
  it("denies count to mass", () => expect(isSafeConversionPossible("count", "mass")).toBe(false));
  it("denies package to volume", () => expect(isSafeConversionPossible("package", "volume")).toBe(false));
  it("allows same type count", () => expect(isSafeConversionPossible("count", "count")).toBe(true));
});

// ─── Ingredient alias matching ────────────────────────────────────────────────

describe("ingredient alias matching", () => {
  const onion = {
    ...makeIngredient(),
    aliases: [
      { id: "a1", ingredientId: "ing-onion", alias: "onions", language: null, countryCode: null, confidence: 1.0, createdAt: new Date() },
      { id: "a2", ingredientId: "ing-onion", alias: "pyaz", language: "hi", countryCode: null, confidence: 0.99, createdAt: new Date() },
      { id: "a3", ingredientId: "ing-onion", alias: "pyaaz", language: "hi", countryCode: null, confidence: 0.98, createdAt: new Date() },
    ],
  };

  it("matches by canonical name exactly", () => {
    const result = matchIngredientByAlias("Onion", [onion]);
    expect(result.found).toBe(true);
    if (result.found) expect(result.confidence).toBe(1.0);
  });

  it("matches by alias exactly", () => {
    const result = matchIngredientByAlias("pyaz", [onion]);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.matchedAlias).toBe("pyaz");
      expect(result.confidence).toBe(0.99);
    }
  });

  it("matches plural alias", () => {
    const result = matchIngredientByAlias("onions", [onion]);
    expect(result.found).toBe(true);
    if (result.found) expect(result.matchedAlias).toBe("onions");
  });

  it("returns not found for unrecognized name", () => {
    const result = matchIngredientByAlias("spaghetti", [onion]);
    expect(result.found).toBe(false);
  });

  it("is case-insensitive", () => {
    const result = matchIngredientByAlias("ONION", [onion]);
    expect(result.found).toBe(true);
  });
});

// ─── Recipe visibility ────────────────────────────────────────────────────────

describe("recipe visibility", () => {
  const orgA = "org-a";
  const orgB = "org-b";

  it("global published recipe is visible to any organization", () => {
    expect(isRecipeVisibleToOrganization(
      { visibility: "global", organizationId: null, isPublished: true },
      orgA,
    )).toBe(true);
  });

  it("organization recipe is visible to its own organization", () => {
    expect(isRecipeVisibleToOrganization(
      { visibility: "organization", organizationId: orgA, isPublished: true },
      orgA,
    )).toBe(true);
  });

  it("organization recipe is NOT visible to other organizations", () => {
    expect(isRecipeVisibleToOrganization(
      { visibility: "organization", organizationId: orgA, isPublished: true },
      orgB,
    )).toBe(false);
  });

  it("private recipe is never visible to any organization", () => {
    expect(isRecipeVisibleToOrganization(
      { visibility: "private", organizationId: orgA, isPublished: true },
      orgA,
    )).toBe(false);
  });

  it("unpublished recipe is never visible", () => {
    expect(isRecipeVisibleToOrganization(
      { visibility: "global", organizationId: null, isPublished: false },
      orgA,
    )).toBe(false);
  });
});

// ─── Server-side access control ───────────────────────────────────────────────

describe("ingredient creation access control", () => {
  beforeEach(() => vi.clearAllMocks());

  it("platform admin can create a global ingredient", async () => {
    const session = makePlatformAdminSession();
    mockPrisma.ingredient.create.mockResolvedValue(
      makeIngredient({ id: "new-ing" }),
    );

    await createIngredient(session as never, {
      name: "Onion",
      canonicalName: "Onion",
      category: "vegetable",
      isGlobal: true,
    });

    expect(mockPrisma.ingredient.create).toHaveBeenCalledOnce();
    expect(recordAdminAuditLog).toHaveBeenCalledOnce();
  });

  it("regular org member cannot create a global ingredient", async () => {
    const session = makeOrgMemberSession(orgA);

    await expect(
      createIngredient(session as never, {
        name: "Onion",
        canonicalName: "Onion",
        category: "vegetable",
        isGlobal: true,
      }),
    ).rejects.toThrow(AccessDeniedError);

    expect(mockPrisma.ingredient.create).not.toHaveBeenCalled();
  });
});

const orgA = "org-a";

describe("recipe admin library access control", () => {
  beforeEach(() => vi.clearAllMocks());

  it("platform admin can create a global recipe", async () => {
    const session = makePlatformAdminSession();
    mockPrisma.recipe.create.mockResolvedValue({
      id: "recipe-1",
      name: "Test Recipe",
      slug: "test-recipe",
      cuisineId: "cuisine-1",
      description: null,
      story: null,
      difficulty: "easy",
      spiceLevel: "mild",
      prepMinutes: 10,
      cookMinutes: 20,
      restMinutes: null,
      servings: 4,
      servingUnit: "serving",
      visibility: "global",
      sourceType: "platform",
      organizationId: null,
      countryCode: null,
      isGlobal: true,
      isPublished: false,
      createdById: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      cuisine: { id: "cuisine-1", name: "Hyderabadi", slug: "hyderabadi" },
      ingredients: [],
      steps: [],
      mediaRefs: [],
      dietaryTags: [],
    });

    await createRecipe(session as never, {
      name: "Test Recipe",
      cuisineId: "cuisine-1",
      difficulty: "easy",
      spiceLevel: "mild",
      prepMinutes: 10,
      cookMinutes: 20,
      servings: 4,
      sourceType: "platform",
      isGlobal: true,
      isPublished: false,
    });

    expect(mockPrisma.recipe.create).toHaveBeenCalledOnce();
    expect(recordAdminAuditLog).toHaveBeenCalledOnce();
  });

  it("org admin cannot create a global recipe", async () => {
    const session = makeOrgMemberSession(orgA);

    await expect(
      createRecipe(session as never, {
        name: "Test Recipe",
        cuisineId: "cuisine-1",
        difficulty: "easy",
        spiceLevel: "mild",
        prepMinutes: 10,
        cookMinutes: 20,
        servings: 4,
        sourceType: "platform",
        isGlobal: true,
      }),
    ).rejects.toThrow(AccessDeniedError);

    expect(mockPrisma.recipe.create).not.toHaveBeenCalled();
  });
});

describe("tenant isolation for organization recipes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listRecipes scopes results to global + org recipes for the active org", async () => {
    mockPrisma.recipe.findMany.mockResolvedValue([]);

    await listRecipes({ organizationId: orgA, publishedOnly: true });

    const query = mockPrisma.recipe.findMany.mock.calls[0]?.[0];
    expect(query).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        isPublished: true,
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: [
              { visibility: "global", isPublished: true },
              { visibility: "organization", organizationId: orgA, isPublished: true },
            ],
          }),
        ]),
        NOT: expect.arrayContaining([
          { slug: { startsWith: "qa-" } },
          { slug: { startsWith: "test-" } },
          { slug: { startsWith: "admin-qa-" } },
        ]),
      }),
    }));
  });
});
