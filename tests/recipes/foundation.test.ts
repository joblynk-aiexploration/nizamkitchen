import fs from "node:fs";
import path from "node:path";
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
    ingredientRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    recipe: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    recipeIngredient: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    recipeStep: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
    $transaction: vi.fn(),
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
import { filterIngredientOptions, getIngredientDisplayName } from "../../src/components/recipes/ingredient-select";
import { createIngredient } from "../../src/server/ingredients";
import {
  approveIngredientRequest,
  createIngredientRequest,
  createRecipe,
  listRecipes,
  listRecipesPage,
  rejectIngredientRequest,
  updateRecipe,
  updateRecipeIngredient,
  updateRecipeStep,
} from "../../src/server/recipes";
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

describe("canonical ingredient search display", () => {
  const ingredientSearchOptions = [
    { id: "ing-onion", name: "Onion", canonicalName: "Onion", category: "vegetable" as const, aliases: [{ alias: "pyaaz" }, { alias: "pyaz" }, { alias: "onions" }] },
    { id: "ing-yogurt", name: "Yogurt", canonicalName: "Yogurt", category: "dairy" as const, aliases: [{ alias: "dahi" }] },
    { id: "ing-tamarind", name: "Tamarind", canonicalName: "Tamarind", category: "condiment" as const, aliases: [{ alias: "imli" }] },
    { id: "ing-turmeric", name: "Turmeric Powder", canonicalName: "Turmeric Powder", category: "spice" as const, aliases: [{ alias: "haldi" }] },
    { id: "ing-chili", name: "Red Chili Powder", canonicalName: "Red Chili Powder", category: "spice" as const, aliases: [{ alias: "lal mirch" }] },
    { id: "ing-ggp", name: "Ginger Garlic Paste", canonicalName: "Ginger Garlic Paste", category: "condiment" as const, aliases: [{ alias: "adrak lehsun" }] },
    { id: "ing-cashews", name: "Cashews", canonicalName: "Cashews", category: "nut" as const, aliases: [{ alias: "kaju" }] },
    { id: "ing-coriander", name: "Coriander Leaves", canonicalName: "Coriander Leaves", category: "herb" as const, aliases: [{ alias: "hara dhania" }] },
    { id: "ing-fried-onions", name: "Fried Onions", canonicalName: "Fried Onions", category: "condiment" as const, aliases: [{ alias: "birista" }] },
    { id: "ing-jaggery", name: "Jaggery", canonicalName: "Jaggery", category: "sweetener" as const, aliases: [{ alias: "gud" }] },
  ];

  it.each([
    ["pyaaz", "Onion"],
    ["pyaz", "Onion"],
    ["onion", "Onion"],
    ["onions", "Onion"],
    ["dahi", "Yogurt"],
    ["imli", "Tamarind"],
    ["haldi", "Turmeric Powder"],
    ["lal mirch", "Red Chili Powder"],
    ["adrak lehsun", "Ginger Garlic Paste"],
    ["kaju", "Cashews"],
    ["hara dhania", "Coriander Leaves"],
    ["birista", "Fried Onions"],
    ["gud", "Jaggery"],
  ])("shows canonical ingredient name for alias search %s", (query, expectedName) => {
    const results = filterIngredientOptions(ingredientSearchOptions, query);

    expect(results[0]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^ing-/),
      displayName: expectedName,
      canonicalName: expectedName,
    }));
    expect(getIngredientDisplayName(results[0])).toBe(expectedName);
    if (query.toLowerCase() !== expectedName.toLowerCase()) {
      expect(results[0].displayName.toLowerCase()).not.toBe(query.toLowerCase());
    }
  });

  it("keeps alias text as helper metadata instead of the main label", () => {
    const [result] = filterIngredientOptions(ingredientSearchOptions, "pyaaz");

    expect(result.displayName).toBe("Onion");
    expect(result.matchedAlias).toBe("pyaaz");
  });

  it("saves recipe ingredients by canonical ingredient id instead of alias text", async () => {
    const session = makeOrgMemberSession(orgA);
    mockPrisma.recipe.findUniqueOrThrow.mockResolvedValue({
      id: "recipe-org-1",
      organizationId: orgA,
      visibility: "private",
      isGlobal: false,
    });
    mockPrisma.recipeIngredient.findFirst.mockResolvedValue({ id: "ri-1" });
    mockPrisma.ingredient.findFirst.mockResolvedValue({ id: "ing-onion", name: "Onion", canonicalName: "Onion" });
    mockPrisma.unit.findUnique.mockResolvedValue({ id: "unit-piece" });
    mockPrisma.recipeIngredient.update.mockResolvedValue({});

    await updateRecipeIngredient(session as never, {
      recipeId: "recipe-org-1",
      recipeIngredientId: "ri-1",
      ingredientId: "ing-onion",
      quantity: 2,
      unitId: "unit-piece",
      preparationNote: "searched as pyaaz",
      section: "Main",
      isOptional: false,
    });

    expect(mockPrisma.ingredient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "ing-onion",
      }),
    }));
    expect(mockPrisma.recipeIngredient.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ingredientId: "ing-onion",
        preparationNote: "searched as pyaaz",
      }),
    }));
  });

  it("keeps admin ingredient pages canonical-first with aliases separate", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/ingredients/page.tsx"), "utf8");

    expect(page).toContain("i.canonicalName");
    expect(page).toContain("Aliases");
    expect(page).toContain("i.aliases.slice");
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

  it("private recipe is visible to its owning organization only", () => {
    expect(isRecipeVisibleToOrganization(
      { visibility: "private", organizationId: orgA, isPublished: true },
      orgA,
    )).toBe(true);

    expect(isRecipeVisibleToOrganization(
      { visibility: "private", organizationId: orgA, isPublished: true },
      orgB,
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

describe("recipe form UI", () => {
  it("uses a dropdown for serving units on new and edit recipe pages", () => {
    const component = fs.readFileSync(path.join(process.cwd(), "src/components/recipes/serving-unit-select.tsx"), "utf8");
    const newPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/recipes/new/page.tsx"), "utf8");
    const editPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/recipes/[id]/edit/page.tsx"), "utf8");

    expect(component).toContain("<select");
    expect(component).toContain('name="servingUnit"');
    expect(component).toContain('value: "serving"');
    expect(component).toContain('value: "tray"');
    expect(component).toContain('value: "family pack"');
    expect(newPage).toContain("<ServingUnitSelect");
    expect(editPage).toContain("<ServingUnitSelect");
    expect(newPage).not.toContain('placeholder="serving, tray, family pack"');
  });

  it("routes household edits of global recipes through a My Recipes copy", () => {
    const editPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/recipes/[id]/edit/page.tsx"), "utf8");

    expect(editPage).toContain("copyRecipeToMyRecipes");
    expect(editPage).toContain("You are editing your My Recipes copy");
    expect(editPage).toContain("The global recipe stays unchanged");
    expect(editPage).toContain("redirect(`/recipes/${copy.id}/edit");
    expect(editPage).toContain('eyebrow={isMyRecipe ? "My Recipes" : recipe.cuisine.name}');
    expect(editPage).toContain("Edit My Recipe:");
    expect(editPage).toContain("Back to My Recipes");
  });

  it("uses a professional canonical ingredient builder on recipe edit", () => {
    const editor = fs.readFileSync(path.join(process.cwd(), "src/components/recipes/recipe-ingredients-editor.tsx"), "utf8");
    const editPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/recipes/[id]/edit/page.tsx"), "utf8");

    expect(editor).toContain("Ingredient Builder");
    expect(editor).toContain("Build grocery-ready ingredients");
    expect(editor).toContain("<IngredientSelect");
    expect(editor).toContain("<UnitSelect");
    expect(editor).toContain("Save ingredient");
    expect(editor).toContain("Move up");
    expect(editor).toContain("Move down");
    expect(editor).toContain("Duplicate ingredient warning");
    expect(editor).toContain("Can&apos;t find this ingredient?");
    expect(editPage).toContain("updateRecipeIngredient");
    expect(editPage).toContain("deleteRecipeIngredient");
    expect(editPage).toContain("moveRecipeIngredient");
  });

  it("minimizes the long recipe edit page with collapsible section panels", () => {
    const section = fs.readFileSync(path.join(process.cwd(), "src/components/recipes/recipe-edit-section.tsx"), "utf8");
    const editPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/recipes/[id]/edit/page.tsx"), "utf8");

    expect(section).toContain("aria-expanded={open}");
    expect(section).toContain("setOpen");
    expect(section).toContain("ChevronDown");
    expect(editPage).toContain("<RecipeEditSection");
    expect(editPage).toContain('eyebrow="Recipe details"');
    expect(editPage).toContain('eyebrow="Ingredients"');
    expect(editPage).toContain('eyebrow="Cooking steps"');
    expect(editPage).toContain('eyebrow="Videos"');
    expect(editPage).not.toContain("defaultOpen");
  });

  it("uses an editable step builder on recipe edit", () => {
    const editor = fs.readFileSync(path.join(process.cwd(), "src/components/recipes/recipe-steps-editor.tsx"), "utf8");
    const editPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/recipes/[id]/edit/page.tsx"), "utf8");

    expect(editor).toContain("Step Builder");
    expect(editor).toContain("Update step");
    expect(editor).toContain("Remove step");
    expect(editor).toContain("Move up");
    expect(editor).toContain("Move down");
    expect(editPage).toContain("<RecipeStepsEditor");
    expect(editPage).toContain("updateRecipeStep");
    expect(editPage).toContain("deleteRecipeStep");
    expect(editPage).toContain("moveRecipeStep");
  });

  it("keeps the main recipes page scoped to global templates, not My Recipes copies", () => {
    const recipesPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/recipes/page.tsx"), "utf8");

    expect(recipesPage).toContain('scope: "global_templates"');
    expect(recipesPage).toContain("Global Recipe Templates");
    expect(recipesPage).toContain("Global template");
    expect(recipesPage).not.toContain("my recipe");
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
              { visibility: "private", organizationId: orgA, isPublished: true },
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

  it("listRecipesPage can scope the public recipe page to global templates only", async () => {
    mockPrisma.recipe.count.mockResolvedValue(0);
    mockPrisma.recipe.findMany.mockResolvedValue([]);

    await listRecipesPage({
      organizationId: orgA,
      publishedOnly: true,
      scope: "global_templates",
    });

    const countQuery = mockPrisma.recipe.count.mock.calls[0]?.[0];
    const findQuery = mockPrisma.recipe.findMany.mock.calls[0]?.[0];

    expect(countQuery).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        isPublished: true,
        AND: expect.arrayContaining([
          expect.objectContaining({
            organizationId: null,
            visibility: "global",
            isPublished: true,
          }),
        ]),
      }),
    }));
    expect(findQuery).toEqual(expect.objectContaining({
      where: countQuery.where,
    }));
  });

  it("prevents household recipe updates from becoming global recipes", async () => {
    const session = makeOrgMemberSession(orgA);
    mockPrisma.recipe.findUniqueOrThrow.mockResolvedValue({
      id: "recipe-org-1",
      organizationId: orgA,
      visibility: "private",
      isGlobal: false,
    });

    await expect(
      updateRecipe(session as never, "recipe-org-1", {
        name: "Household Biryani",
        visibility: "global",
      }),
    ).rejects.toThrow("My Recipes");

    expect(mockPrisma.recipe.update).not.toHaveBeenCalled();
  });

  it("updates household recipe ingredients with canonical ingredient and unit records", async () => {
    const session = makeOrgMemberSession(orgA);
    mockPrisma.recipe.findUniqueOrThrow.mockResolvedValue({
      id: "recipe-org-1",
      organizationId: orgA,
      visibility: "private",
      isGlobal: false,
    });
    mockPrisma.recipeIngredient.findFirst.mockResolvedValue({ id: "ri-1" });
    mockPrisma.ingredient.findFirst.mockResolvedValue({ id: "ing-onion" });
    mockPrisma.unit.findUnique.mockResolvedValue({ id: "unit-gram" });
    mockPrisma.recipeIngredient.update.mockResolvedValue({});

    await updateRecipeIngredient(session as never, {
      recipeId: "recipe-org-1",
      recipeIngredientId: "ri-1",
      ingredientId: "ing-onion",
      quantity: 2,
      unitId: "unit-gram",
      preparationNote: "sliced",
      section: "Main",
      isOptional: false,
    });

    expect(mockPrisma.recipeIngredient.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ri-1" },
      data: expect.objectContaining({
        ingredientId: "ing-onion",
        quantity: 2,
        unitId: "unit-gram",
      }),
    }));
  });

  it("prevents household users from editing ingredients on global recipes", async () => {
    const session = makeOrgMemberSession(orgA);
    mockPrisma.recipe.findUniqueOrThrow.mockResolvedValue({
      id: "recipe-global-1",
      organizationId: null,
      visibility: "global",
      isGlobal: true,
    });

    await expect(
      updateRecipeIngredient(session as never, {
        recipeId: "recipe-global-1",
        recipeIngredientId: "ri-1",
        ingredientId: "ing-onion",
        quantity: 1,
        unitId: "unit-gram",
      }),
    ).rejects.toThrow(AccessDeniedError);

    expect(mockPrisma.recipeIngredient.update).not.toHaveBeenCalled();
  });

  it("updates household recipe steps without changing global recipes", async () => {
    const session = makeOrgMemberSession(orgA);
    mockPrisma.recipe.findUniqueOrThrow.mockResolvedValue({
      id: "recipe-org-1",
      organizationId: orgA,
      visibility: "private",
      isGlobal: false,
    });
    mockPrisma.recipeStep.findFirst.mockResolvedValue({ id: "step-1" });
    mockPrisma.recipeStep.update.mockResolvedValue({});

    await updateRecipeStep(session as never, {
      recipeId: "recipe-org-1",
      stepId: "step-1",
      title: "Temper spices",
      instruction: "Heat oil and bloom the spices.",
      durationMinutes: 3,
      tips: "Keep the heat gentle.",
    });

    expect(mockPrisma.recipeStep.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "step-1" },
      data: expect.objectContaining({
        title: "Temper spices",
        instruction: "Heat oil and bloom the spices.",
        durationMinutes: 3,
      }),
    }));
  });
});

describe("household ingredient requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an org-scoped canonical ingredient request", async () => {
    const session = makeOrgMemberSession(orgA);
    mockPrisma.ingredientRequest.create.mockResolvedValue({
      id: "request-1",
      organizationId: orgA,
      requestedById: session.user.id,
      requestedName: "Dried rose petals",
      suggestedCategory: "herb",
      notes: null,
      status: "pending",
      reviewedById: null,
      reviewedAt: null,
      createdIngredientId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createIngredientRequest({
      session: session as never,
      organizationId: orgA,
      requestedName: " Dried rose petals ",
      suggestedCategory: "herb",
    });

    expect(mockPrisma.ingredientRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: orgA,
        requestedById: session.user.id,
        requestedName: "Dried rose petals",
        suggestedCategory: "herb",
      }),
    });
  });

  it("platform admin can approve a request into a canonical ingredient", async () => {
    const session = makePlatformAdminSession();
    mockPrisma.ingredientRequest.findUnique.mockResolvedValue({
      id: "request-1",
      organizationId: orgA,
      requestedById: "user-member",
      requestedName: "Dried rose petals",
      suggestedCategory: "herb",
      notes: null,
      status: "pending",
      reviewedById: null,
      reviewedAt: null,
      createdIngredientId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.ingredient.create.mockResolvedValue(makeIngredient({ id: "ing-rose", name: "Dried rose petals", canonicalName: "Dried rose petals", category: "herb" }));
    mockPrisma.ingredientRequest.update.mockResolvedValue({});

    await approveIngredientRequest({
      session: session as never,
      requestId: "request-1",
      category: "herb",
    });

    expect(mockPrisma.ingredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Dried rose petals",
        canonicalName: "Dried rose petals",
        category: "herb",
        isGlobal: true,
      }),
    });
    expect(mockPrisma.ingredientRequest.update).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: expect.objectContaining({
        status: "approved",
        reviewedById: session.user.id,
        createdIngredientId: "ing-rose",
      }),
    });
  });

  it("platform admin can reject a pending request", async () => {
    const session = makePlatformAdminSession();
    mockPrisma.ingredientRequest.findUnique.mockResolvedValue({
      id: "request-2",
      organizationId: orgA,
      requestedById: "user-member",
      requestedName: "Unknown masala",
      suggestedCategory: null,
      notes: null,
      status: "pending",
      reviewedById: null,
      reviewedAt: null,
      createdIngredientId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.ingredientRequest.update.mockResolvedValue({});

    await rejectIngredientRequest({
      session: session as never,
      requestId: "request-2",
    });

    expect(mockPrisma.ingredientRequest.update).toHaveBeenCalledWith({
      where: { id: "request-2" },
      data: expect.objectContaining({
        status: "rejected",
        reviewedById: session.user.id,
      }),
    });
  });
});
