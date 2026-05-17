import { describe, expect, it } from "vitest";
import type { Unit, Ingredient, UnitConversion } from "@prisma/client";
import { calculateGroceryItems } from "../../src/server/grocery/grocery-calculator";
import type { ScaledIngredient } from "../../src/lib/grocery";
import { formatGroceryQuantity, sortOrderForCategory } from "../../src/lib/grocery-display";
import { normalizeToBaseUnit, confidenceFromNumber } from "../../src/server/grocery/grocery-normalizer";

// ─── Factories ────────────────────────────────────────────────────────────────

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
    averagePieceWeightGrams: null,
    isGlobal: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

type ConversionRow = UnitConversion & {
  fromUnit: Unit;
  toUnit: Unit;
  ingredient: (Ingredient & { averagePieceWeightGrams: number | null }) | null;
};

function makeConversion(overrides: Partial<ConversionRow> = {}): ConversionRow {
  const gram = makeUnit();
  const kg = makeUnit({ id: "unit-kg", code: "kilogram", name: "kilogram", pluralName: "kilograms", symbol: "kg", isBaseUnit: false });
  return {
    id: "conv-1",
    fromUnitId: "unit-kg",
    toUnitId: "unit-gram",
    ingredientId: null,
    multiplier: 1000,
    offset: null,
    confidence: 1.0,
    notes: null,
    isGlobal: true,
    countryCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    fromUnit: kg,
    toUnit: gram,
    ingredient: null,
    ...overrides,
  };
}

function makeScaledIngredient(overrides: Partial<ScaledIngredient> = {}): ScaledIngredient {
  const gram = makeUnit();
  const ingredient = makeIngredient();
  return {
    recipeId: "recipe-biryani",
    recipeNameSnapshot: "Biryani",
    recipeIngredientId: "ri-1",
    ingredientId: "ing-onion",
    ingredientNameSnapshot: "Onion",
    canonicalIngredientName: "Onion",
    category: "vegetable",
    originalQuantity: 500,
    originalUnit: gram,
    scaledQuantity: 500,
    ingredient,
    ...overrides,
  };
}

// ─── Scaling tests ────────────────────────────────────────────────────────────

describe("recipe scaling", () => {
  it("doubles all quantities when scaling from 4 to 8 servings", () => {
    const originalServings = 4;
    const targetServings = 8;
    const scaleFactor = targetServings / originalServings;
    expect(scaleFactor).toBe(2);

    const gram = makeUnit();
    const entry = makeScaledIngredient({
      originalQuantity: 250,
      scaledQuantity: 250 * scaleFactor,
    });

    const result = calculateGroceryItems({
      scaledIngredients: [entry],
      conversions: [],
      units: [gram],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalQuantity).toBe(500);
  });

  it("halves all quantities when scaling from 4 to 2 servings", () => {
    const scaleFactor = 2 / 4;
    expect(scaleFactor).toBe(0.5);

    const gram = makeUnit();
    const entry = makeScaledIngredient({
      originalQuantity: 500,
      scaledQuantity: 500 * scaleFactor,
    });

    const result = calculateGroceryItems({
      scaledIngredients: [entry],
      conversions: [],
      units: [gram],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalQuantity).toBe(250);
  });
});

// ─── Same ingredient, same unit ───────────────────────────────────────────────

describe("merge: same ingredient, same unit", () => {
  it("sums two entries with identical units to exact merge", () => {
    const gram = makeUnit();
    const entries = [
      makeScaledIngredient({ recipeId: "r1", recipeNameSnapshot: "Biryani", recipeIngredientId: "ri-1", scaledQuantity: 500 }),
      makeScaledIngredient({ recipeId: "r2", recipeNameSnapshot: "Dal", recipeIngredientId: "ri-2", scaledQuantity: 300 }),
    ];

    const result = calculateGroceryItems({ scaledIngredients: entries, conversions: [], units: [gram] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalQuantity).toBe(800);
    expect(result.items[0].confidence).toBe("exact");
    expect(result.items[0].mergeStatus).toBe("merged");
    expect(result.items[0].sources).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  it("tracks all source recipes in merged item", () => {
    const gram = makeUnit();
    const entries = [
      makeScaledIngredient({ recipeId: "r1", recipeNameSnapshot: "Biryani", recipeIngredientId: "ri-1", scaledQuantity: 200 }),
      makeScaledIngredient({ recipeId: "r2", recipeNameSnapshot: "Dal", recipeIngredientId: "ri-2", scaledQuantity: 150 }),
      makeScaledIngredient({ recipeId: "r3", recipeNameSnapshot: "Salan", recipeIngredientId: "ri-3", scaledQuantity: 100 }),
    ];

    const result = calculateGroceryItems({ scaledIngredients: entries, conversions: [], units: [gram] });

    expect(result.items[0].sources).toHaveLength(3);
    expect(result.items[0].sources.map((s) => s.recipeNameSnapshot)).toEqual(["Biryani", "Dal", "Salan"]);
  });
});

// ─── Same ingredient, mass units (different) ──────────────────────────────────

describe("merge: same ingredient, mass units", () => {
  it("normalizes gram + kg to base unit (gram) and sums", () => {
    const gram = makeUnit();
    const kg = makeUnit({ id: "unit-kg", code: "kilogram", name: "kilogram", pluralName: "kilograms", symbol: "kg", isBaseUnit: false });
    const kgToGram = makeConversion({ fromUnitId: "unit-kg", toUnitId: "unit-gram", fromUnit: kg, toUnit: gram, multiplier: 1000, confidence: 1.0 });

    const entries = [
      makeScaledIngredient({ recipeIngredientId: "ri-1", originalUnit: gram, scaledQuantity: 500 }),
      makeScaledIngredient({ recipeIngredientId: "ri-2", originalUnit: kg, scaledQuantity: 1 }),
    ];

    const result = calculateGroceryItems({ scaledIngredients: entries, conversions: [kgToGram], units: [gram, kg] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalQuantity).toBe(1500);
    expect(result.items[0].unitId).toBe("unit-gram");
    expect(result.items[0].mergeStatus).toBe("merged");
    expect(result.warnings).toHaveLength(0);
  });

  it("displays 1500g as 1.5 kg in displayUnit", () => {
    const gram = makeUnit();
    const kg = makeUnit({ id: "unit-kg", code: "kilogram", name: "kilogram", pluralName: "kilograms", symbol: "kg", isBaseUnit: false });
    const kgToGram = makeConversion({ fromUnitId: "unit-kg", toUnitId: "unit-gram", fromUnit: kg, toUnit: gram, multiplier: 1000, confidence: 1.0 });

    const entries = [
      makeScaledIngredient({ recipeIngredientId: "ri-1", originalUnit: gram, scaledQuantity: 500 }),
      makeScaledIngredient({ recipeIngredientId: "ri-2", originalUnit: kg, scaledQuantity: 1 }),
    ];

    const result = calculateGroceryItems({ scaledIngredients: entries, conversions: [kgToGram], units: [gram, kg] });

    expect(result.items[0].displayQuantity).toBe(1.5);
    expect(result.items[0].displayUnit).toBe("kg");
  });
});

// ─── Same ingredient, volume units ───────────────────────────────────────────

describe("merge: same ingredient, volume units", () => {
  it("sums ml + ml directly", () => {
    const ml = makeUnit({ id: "unit-ml", code: "milliliter", name: "milliliter", pluralName: "milliliters", type: "volume", system: "metric", symbol: "ml", isBaseUnit: true });

    const entries = [
      makeScaledIngredient({ recipeIngredientId: "ri-1", ingredientId: "ing-oil", originalUnit: ml, scaledQuantity: 30 }),
      makeScaledIngredient({ recipeIngredientId: "ri-2", ingredientId: "ing-oil", originalUnit: ml, scaledQuantity: 15 }),
    ];

    const result = calculateGroceryItems({ scaledIngredients: entries, conversions: [], units: [ml] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalQuantity).toBe(45);
    expect(result.items[0].confidence).toBe("exact");
  });
});

// ─── Unsafe count-to-mass ─────────────────────────────────────────────────────

describe("merge: unsafe count to mass", () => {
  it("marks items needs_review when count and mass units appear for the same ingredient", () => {
    const gram = makeUnit();
    const piece = makeUnit({ id: "unit-piece", code: "piece", name: "piece", pluralName: "pieces", type: "count", system: "mixed", isBaseUnit: true });

    const entries = [
      makeScaledIngredient({ recipeIngredientId: "ri-1", originalUnit: piece, scaledQuantity: 2 }),
      makeScaledIngredient({ recipeIngredientId: "ri-2", originalUnit: gram, scaledQuantity: 100 }),
    ];

    const result = calculateGroceryItems({ scaledIngredients: entries, conversions: [], units: [gram, piece] });

    expect(result.items.every((i) => i.mergeStatus === "needs_review")).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toMatch(/count and weight\/volume/i);
  });
});

// ─── Unknown conversion warning ───────────────────────────────────────────────

describe("warnings: unknown conversion", () => {
  it("generates a warning when unit has no base-unit conversion path", () => {
    const cup = makeUnit({ id: "unit-cup", code: "cup", name: "cup", pluralName: "cups", type: "volume", system: "mixed", symbol: "cup", isBaseUnit: false });
    const ml = makeUnit({ id: "unit-ml", code: "milliliter", name: "milliliter", pluralName: "milliliters", type: "volume", system: "metric", symbol: "ml", isBaseUnit: true });

    // cup + ml, but no conversion from cup to ml
    const entries = [
      makeScaledIngredient({ recipeIngredientId: "ri-1", ingredientId: "ing-water", originalUnit: cup, scaledQuantity: 1 }),
      makeScaledIngredient({ recipeIngredientId: "ri-2", ingredientId: "ing-water", originalUnit: ml, scaledQuantity: 100 }),
    ];

    const result = calculateGroceryItems({ scaledIngredients: entries, conversions: [], units: [cup, ml] });

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── Display formatting ───────────────────────────────────────────────────────

describe("display formatting", () => {
  it("displays grams under 1000 with symbol", () => {
    expect(formatGroceryQuantity(250, "gram", "g")).toBe("250 g");
  });

  it("displays 1000g as 1 kg", () => {
    expect(formatGroceryQuantity(1000, "gram", "g")).toBe("1 kg");
  });

  it("displays 1500g as 1.5 kg", () => {
    expect(formatGroceryQuantity(1500, "gram", "g")).toBe("1.5 kg");
  });

  it("displays 1000ml as 1 L", () => {
    expect(formatGroceryQuantity(1000, "milliliter", "ml")).toBe("1 L");
  });

  it("displays piece counts as integers", () => {
    expect(formatGroceryQuantity(5, "piece", null)).toBe("5");
  });
});

// ─── Category sort order ──────────────────────────────────────────────────────

describe("category sorting", () => {
  it("vegetables sort before spices", () => {
    expect(sortOrderForCategory("vegetable")).toBeLessThan(sortOrderForCategory("spice"));
  });

  it("grains sort before oils", () => {
    expect(sortOrderForCategory("grain")).toBeLessThan(sortOrderForCategory("oil"));
  });
});

// ─── Normalizer ───────────────────────────────────────────────────────────────

describe("normalizeToBaseUnit", () => {
  it("returns quantity unchanged when already base unit", () => {
    const gram = makeUnit();
    const result = normalizeToBaseUnit(500, gram, [gram], []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quantity).toBe(500);
      expect(result.conversionApplied).toBe(false);
    }
  });

  it("converts kg to gram using conversion row", () => {
    const gram = makeUnit();
    const kg = makeUnit({ id: "unit-kg", code: "kilogram", name: "kilogram", pluralName: "kilograms", symbol: "kg", isBaseUnit: false });
    const conv = makeConversion({ fromUnitId: "unit-kg", toUnitId: "unit-gram", fromUnit: kg, toUnit: gram, multiplier: 1000, confidence: 1.0 });

    const result = normalizeToBaseUnit(2, kg, [gram, kg], [conv]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quantity).toBe(2000);
      expect(result.unit.id).toBe("unit-gram");
    }
  });

  it("returns error when no base unit exists for type", () => {
    const specialUnit = makeUnit({ id: "u-special", code: "special", type: "custom", isBaseUnit: false });
    const result = normalizeToBaseUnit(1, specialUnit, [], []);
    expect(result.ok).toBe(false);
  });
});

// ─── Confidence levels ────────────────────────────────────────────────────────

describe("confidenceFromNumber", () => {
  it("maps 1.0 → exact", () => expect(confidenceFromNumber(1.0)).toBe("exact"));
  it("maps 0.98 → high", () => expect(confidenceFromNumber(0.98)).toBe("high"));
  it("maps 0.85 → medium", () => expect(confidenceFromNumber(0.85)).toBe("medium"));
  it("maps 0.5 → low", () => expect(confidenceFromNumber(0.5)).toBe("low"));
  it("maps 0 → unknown", () => expect(confidenceFromNumber(0)).toBe("unknown"));
});

// ─── Single ingredient, no merge needed ──────────────────────────────────────

describe("single-source item", () => {
  it("marks single source item as separate with exact confidence", () => {
    const gram = makeUnit();
    const result = calculateGroceryItems({
      scaledIngredients: [makeScaledIngredient({ scaledQuantity: 300 })],
      conversions: [],
      units: [gram],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].mergeStatus).toBe("separate");
    expect(result.items[0].confidence).toBe("exact");
    expect(result.items[0].sources).toHaveLength(1);
  });
});

// ─── Snapshot preservation ────────────────────────────────────────────────────

describe("snapshot preservation", () => {
  it("stores recipe and ingredient name snapshots at calculation time", () => {
    const gram = makeUnit();
    const entry = makeScaledIngredient({
      recipeNameSnapshot: "My Special Biryani v3",
      ingredientNameSnapshot: "Yellow Onion (large)",
      canonicalIngredientName: "Onion",
      scaledQuantity: 200,
    });

    const result = calculateGroceryItems({ scaledIngredients: [entry], conversions: [], units: [gram] });

    const item = result.items[0];
    expect(item.ingredientNameSnapshot).toBe("Yellow Onion (large)");
    expect(item.canonicalIngredientName).toBe("Onion");
    expect(item.sources[0].recipeNameSnapshot).toBe("My Special Biryani v3");
  });
});
