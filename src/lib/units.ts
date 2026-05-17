import type { Unit, UnitConversion, Ingredient } from "@prisma/client";

export type ConversionResult =
  | { ok: true; value: number; confidence: number; notes?: string | null }
  | { ok: false; reason: string };

type ConversionRow = UnitConversion & {
  fromUnit: Unit;
  toUnit: Unit;
  ingredient: (Ingredient & { averagePieceWeightGrams: number | null }) | null;
};

// Units of these types cannot be auto-converted to mass/volume without
// ingredient-specific data. Refusing this protects the grocery engine from
// silent wrong quantities.
const COUNT_TYPES = new Set(["count", "package"]);
const MASS_VOLUME_TYPES = new Set(["mass", "volume"]);

export function isSafeConversionPossible(
  fromType: string,
  toType: string,
): boolean {
  if (fromType === toType) return true;
  // count/package → mass/volume always requires ingredient-specific data
  if (COUNT_TYPES.has(fromType) && MASS_VOLUME_TYPES.has(toType)) return false;
  if (MASS_VOLUME_TYPES.has(toType) && COUNT_TYPES.has(fromType)) return false;
  return true;
}

export function convertUnit(params: {
  quantity: number;
  fromUnit: Unit;
  toUnit: Unit;
  conversions: ConversionRow[];
  ingredient?: (Ingredient & { averagePieceWeightGrams: number | null }) | null;
}): ConversionResult {
  const { quantity, fromUnit, toUnit, conversions, ingredient } = params;

  if (fromUnit.id === toUnit.id) {
    return { ok: true, value: quantity, confidence: 1.0 };
  }

  // Refuse count-to-mass/volume without ingredient-specific conversion
  if (
    COUNT_TYPES.has(fromUnit.type) &&
    MASS_VOLUME_TYPES.has(toUnit.type) &&
    !ingredient
  ) {
    return {
      ok: false,
      reason: `Cannot convert ${fromUnit.name} to ${toUnit.name} without ingredient-specific data.`,
    };
  }

  // Prefer ingredient-specific conversion if ingredient is provided
  const ingredientConversion = ingredient
    ? conversions.find(
        (c) =>
          c.fromUnitId === fromUnit.id &&
          c.toUnitId === toUnit.id &&
          c.ingredientId === ingredient.id,
      )
    : null;

  if (ingredientConversion) {
    const value = quantity * ingredientConversion.multiplier + (ingredientConversion.offset ?? 0);
    return {
      ok: true,
      value,
      confidence: ingredientConversion.confidence,
      notes: ingredientConversion.notes,
    };
  }

  // Check for piece→gram via averagePieceWeightGrams on ingredient
  if (
    fromUnit.type === "count" &&
    fromUnit.code === "piece" &&
    toUnit.type === "mass" &&
    toUnit.code === "gram" &&
    ingredient?.averagePieceWeightGrams
  ) {
    return {
      ok: true,
      value: quantity * ingredient.averagePieceWeightGrams,
      confidence: 0.8,
      notes: `Estimated from average piece weight of ${ingredient.averagePieceWeightGrams}g.`,
    };
  }

  // Fall back to global conversion
  const globalConversion = conversions.find(
    (c) =>
      c.fromUnitId === fromUnit.id &&
      c.toUnitId === toUnit.id &&
      c.ingredientId === null,
  );

  if (globalConversion) {
    // Refuse if this would be a count→mass/volume global conversion (unsafe)
    if (
      COUNT_TYPES.has(fromUnit.type) &&
      MASS_VOLUME_TYPES.has(toUnit.type)
    ) {
      return {
        ok: false,
        reason: `Global conversion from ${fromUnit.name} to ${toUnit.name} is not permitted without ingredient-specific weight data.`,
      };
    }

    const value = quantity * globalConversion.multiplier + (globalConversion.offset ?? 0);
    return {
      ok: true,
      value,
      confidence: globalConversion.confidence,
      notes: globalConversion.notes,
    };
  }

  // Try two-step conversion via a shared base unit (e.g. tsp → ml → L)
  const twoStepResult = tryTwoStepConversion(quantity, fromUnit, toUnit, conversions);
  if (twoStepResult) return twoStepResult;

  return {
    ok: false,
    reason: `No conversion path found from ${fromUnit.name} to ${toUnit.name}.`,
  };
}

function tryTwoStepConversion(
  quantity: number,
  fromUnit: Unit,
  toUnit: Unit,
  conversions: ConversionRow[],
): ConversionResult | null {
  const fromLegs = conversions.filter(
    (c) => c.fromUnitId === fromUnit.id && c.ingredientId === null,
  );

  for (const leg1 of fromLegs) {
    const leg2 = conversions.find(
      (c) =>
        c.fromUnitId === leg1.toUnitId &&
        c.toUnitId === toUnit.id &&
        c.ingredientId === null,
    );
    if (!leg2) continue;

    // Don't allow count→mass/volume in two-step either
    if (
      COUNT_TYPES.has(fromUnit.type) &&
      MASS_VOLUME_TYPES.has(toUnit.type)
    ) {
      return null;
    }

    const intermediate = quantity * leg1.multiplier + (leg1.offset ?? 0);
    const value = intermediate * leg2.multiplier + (leg2.offset ?? 0);
    const confidence = leg1.confidence * leg2.confidence;
    return { ok: true, value, confidence };
  }

  return null;
}
