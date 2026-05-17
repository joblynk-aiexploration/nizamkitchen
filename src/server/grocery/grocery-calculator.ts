import type { Unit, UnitConversion, Ingredient } from "@prisma/client";
import type { ScaledIngredient, CalculatedItem, CalculationWarning, CalculationOutput, CalculatedItemSource, GroceryConfidenceLevel } from "@/lib/grocery";
import { normalizeToBaseUnit, confidenceFromNumber } from "./grocery-normalizer";
import { sortOrderForCategory } from "@/lib/grocery-display";

type ConversionRow = UnitConversion & {
  fromUnit: Unit;
  toUnit: Unit;
  ingredient: (Ingredient & { averagePieceWeightGrams: number | null }) | null;
};

export function calculateGroceryItems(params: {
  scaledIngredients: ScaledIngredient[];
  conversions: ConversionRow[];
  units: Unit[];
}): CalculationOutput {
  const { scaledIngredients, conversions, units } = params;

  // Group by ingredient ID
  const groups = new Map<string, ScaledIngredient[]>();
  for (const entry of scaledIngredients) {
    const group = groups.get(entry.ingredientId) ?? [];
    group.push(entry);
    groups.set(entry.ingredientId, group);
  }

  const items: CalculatedItem[] = [];
  const warnings: CalculationWarning[] = [];
  let sortOrder = 0;

  for (const [, entries] of groups) {
    sortOrder++;
    const result = mergeIngredientGroup(entries, conversions, units);
    for (const item of result.items) {
      items.push({ ...item, sortOrder: sortOrder + (sortOrderForCategory(item.category) * 100) });
    }
    warnings.push(...result.warnings);
  }

  items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return { items, warnings };
}

function mergeIngredientGroup(
  entries: ScaledIngredient[],
  conversions: ConversionRow[],
  units: Unit[],
): { items: CalculatedItem[]; warnings: CalculationWarning[] } {
  const warnings: CalculationWarning[] = [];
  const first = entries[0];

  if (entries.length === 1) {
    const entry = entries[0];
    const source: CalculatedItemSource = {
      recipeId: entry.recipeId,
      recipeNameSnapshot: entry.recipeNameSnapshot,
      recipeIngredientId: entry.recipeIngredientId,
      originalQuantity: entry.originalQuantity,
      originalUnitId: entry.originalUnit.id,
      originalUnitNameSnapshot: entry.originalUnit.name,
      scaledQuantity: entry.scaledQuantity,
      scaledUnitId: entry.originalUnit.id,
      scaledUnitNameSnapshot: entry.originalUnit.name,
      conversionApplied: false,
      conversionConfidence: 1.0,
      warning: null,
    };
    const display = buildDisplay(entry.scaledQuantity, entry.originalUnit);
    return {
      items: [{
        ingredientId: entry.ingredientId,
        ingredientNameSnapshot: entry.ingredientNameSnapshot,
        canonicalIngredientName: entry.canonicalIngredientName,
        category: entry.category,
        totalQuantity: entry.scaledQuantity,
        unitId: entry.originalUnit.id,
        unitNameSnapshot: entry.originalUnit.name,
        displayQuantity: display.quantity,
        displayUnit: display.unit,
        confidence: "exact",
        mergeStatus: "separate",
        notes: null,
        sources: [source],
        sortOrder: 0,
      }],
      warnings,
    };
  }

  // Check if all entries share the same unit
  const allSameUnit = entries.every((e) => e.originalUnit.id === first.originalUnit.id);
  if (allSameUnit) {
    const total = entries.reduce((sum, e) => sum + e.scaledQuantity, 0);
    const sources = entries.map((e) => buildSource(e, e.originalUnit, e.scaledQuantity, false, 1.0, null));
    const display = buildDisplay(total, first.originalUnit);
    return {
      items: [{
        ingredientId: first.ingredientId,
        ingredientNameSnapshot: first.ingredientNameSnapshot,
        canonicalIngredientName: first.canonicalIngredientName,
        category: first.category,
        totalQuantity: total,
        unitId: first.originalUnit.id,
        unitNameSnapshot: first.originalUnit.name,
        displayQuantity: display.quantity,
        displayUnit: display.unit,
        confidence: "exact",
        mergeStatus: "merged",
        notes: null,
        sources,
        sortOrder: 0,
      }],
      warnings,
    };
  }

  // Group entries by unit type
  const byType = new Map<string, ScaledIngredient[]>();
  for (const entry of entries) {
    const typeGroup = byType.get(entry.originalUnit.type) ?? [];
    typeGroup.push(entry);
    byType.set(entry.originalUnit.type, typeGroup);
  }

  // If all entries are same type but different units: normalize to base and merge
  if (byType.size === 1) {
    return mergeWithNormalization(entries, conversions, units, warnings);
  }

  // Mixed types: try to merge within each type, then attempt cross-type merge
  const typeItems: CalculatedItem[] = [];
  const typeWarnings: CalculationWarning[] = [...warnings];

  for (const [, typeEntries] of byType) {
    const typeResult = typeEntries.length === 1
      ? (() => {
          const e = typeEntries[0];
          const display = buildDisplay(e.scaledQuantity, e.originalUnit);
          return {
            items: [{
              ingredientId: e.ingredientId,
              ingredientNameSnapshot: e.ingredientNameSnapshot,
              canonicalIngredientName: e.canonicalIngredientName,
              category: e.category,
              totalQuantity: e.scaledQuantity,
              unitId: e.originalUnit.id,
              unitNameSnapshot: e.originalUnit.name,
              displayQuantity: display.quantity,
              displayUnit: display.unit,
              confidence: "exact" as GroceryConfidenceLevel,
              mergeStatus: "separate" as const,
              notes: null,
              sources: [buildSource(e, e.originalUnit, e.scaledQuantity, false, 1.0, null)],
              sortOrder: 0,
            }],
            warnings: [],
          };
        })()
      : mergeWithNormalization(typeEntries, conversions, units, []);

    typeItems.push(...typeResult.items);
    typeWarnings.push(...typeResult.warnings);
  }

  // If we have both count and mass/volume type groups, try cross-type conversion
  const countItems = typeItems.filter((item) => {
    const unit = units.find((u) => u.id === item.unitId);
    return unit?.type === "count";
  });
  const massVolumeItems = typeItems.filter((item) => {
    const unit = units.find((u) => u.id === item.unitId);
    return unit && ["mass", "volume"].includes(unit.type);
  });

  if (countItems.length > 0 && massVolumeItems.length > 0) {
    // Cannot auto-merge count + mass without ingredient data — flag needs_review
    typeWarnings.push({
      ingredientId: first.ingredientId,
      message: `"${first.canonicalIngredientName}" appears in both count and weight/volume units across recipes. Review and adjust manually.`,
      severity: "warning",
      sourceRecipeId: null,
      sourceRecipeName: null,
    });
    return {
      items: typeItems.map((item) => ({ ...item, mergeStatus: "needs_review" as const })),
      warnings: typeWarnings,
    };
  }

  // Otherwise all items are same type but from the type grouping — already handled
  return { items: typeItems, warnings: typeWarnings };
}

function mergeWithNormalization(
  entries: ScaledIngredient[],
  conversions: ConversionRow[],
  units: Unit[],
  existingWarnings: CalculationWarning[],
): { items: CalculatedItem[]; warnings: CalculationWarning[] } {
  const warnings = [...existingWarnings];
  const first = entries[0];
  const sources: CalculatedItemSource[] = [];
  let totalInBase = 0;
  let minConfidence = 1.0;
  let conversionFailed = false;
  let baseUnit: Unit | null = null;

  for (const entry of entries) {
    const normalized = normalizeToBaseUnit(
      entry.scaledQuantity,
      entry.originalUnit,
      units,
      conversions,
      entry.ingredient,
    );

    if (normalized.ok) {
      baseUnit = normalized.unit;
      totalInBase += normalized.quantity;
      minConfidence = Math.min(minConfidence, normalized.confidence);
      sources.push(buildSource(entry, normalized.unit, normalized.quantity, normalized.conversionApplied, normalized.confidence, null));
    } else {
      conversionFailed = true;
      sources.push(buildSource(entry, entry.originalUnit, entry.scaledQuantity, false, 0, normalized.reason));
      warnings.push({
        ingredientId: entry.ingredientId,
        message: `Could not normalize "${entry.originalUnit.name}" for "${entry.canonicalIngredientName}": ${normalized.reason}`,
        severity: "warning",
        sourceRecipeId: entry.recipeId,
        sourceRecipeName: entry.recipeNameSnapshot,
      });
    }
  }

  if (conversionFailed || !baseUnit) {
    return {
      items: entries.map((e) => {
        const display = buildDisplay(e.scaledQuantity, e.originalUnit);
        return {
          ingredientId: e.ingredientId,
          ingredientNameSnapshot: e.ingredientNameSnapshot,
          canonicalIngredientName: e.canonicalIngredientName,
          category: e.category,
          totalQuantity: e.scaledQuantity,
          unitId: e.originalUnit.id,
          unitNameSnapshot: e.originalUnit.name,
          displayQuantity: display.quantity,
          displayUnit: display.unit,
          confidence: "unknown" as GroceryConfidenceLevel,
          mergeStatus: "conversion_failed" as const,
          notes: null,
          sources: [buildSource(e, e.originalUnit, e.scaledQuantity, false, 0, null)],
          sortOrder: 0,
        };
      }),
      warnings,
    };
  }

  const display = buildDisplay(totalInBase, baseUnit);
  const confidence = confidenceFromNumber(minConfidence);

  return {
    items: [{
      ingredientId: first.ingredientId,
      ingredientNameSnapshot: first.ingredientNameSnapshot,
      canonicalIngredientName: first.canonicalIngredientName,
      category: first.category,
      totalQuantity: totalInBase,
      unitId: baseUnit.id,
      unitNameSnapshot: baseUnit.name,
      displayQuantity: display.quantity,
      displayUnit: display.unit,
      confidence,
      mergeStatus: "merged",
      notes: null,
      sources,
      sortOrder: 0,
    }],
    warnings,
  };
}

function buildDisplay(quantity: number, unit: Unit): { quantity: number; unit: string } {
  if (unit.code === "gram" && quantity >= 1000) {
    return { quantity: Math.round((quantity / 1000) * 10) / 10, unit: "kg" };
  }
  if (unit.code === "milliliter" && quantity >= 1000) {
    return { quantity: Math.round((quantity / 1000) * 10) / 10, unit: "L" };
  }
  return { quantity: Math.round(quantity * 100) / 100, unit: unit.symbol ?? unit.code };
}

function buildSource(
  entry: ScaledIngredient,
  normalizedUnit: Unit,
  normalizedQuantity: number,
  conversionApplied: boolean,
  confidence: number,
  warning: string | null,
): CalculatedItemSource {
  return {
    recipeId: entry.recipeId,
    recipeNameSnapshot: entry.recipeNameSnapshot,
    recipeIngredientId: entry.recipeIngredientId,
    originalQuantity: entry.originalQuantity,
    originalUnitId: entry.originalUnit.id,
    originalUnitNameSnapshot: entry.originalUnit.name,
    scaledQuantity: normalizedQuantity,
    scaledUnitId: normalizedUnit.id,
    scaledUnitNameSnapshot: normalizedUnit.name,
    conversionApplied,
    conversionConfidence: confidence,
    warning,
  };
}
