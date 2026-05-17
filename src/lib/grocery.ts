import type { Unit, Ingredient } from "@prisma/client";
import type { UnitConversion } from "@prisma/client";

export type GroceryConfidenceLevel = "exact" | "high" | "medium" | "low" | "unknown";
export type GroceryMergeStatusValue = "merged" | "separate" | "needs_review" | "conversion_failed";
export type WarningSeverityLevel = "info" | "warning" | "error";

export type ConversionRow = UnitConversion & {
  fromUnit: Unit;
  toUnit: Unit;
  ingredient: (Ingredient & { averagePieceWeightGrams: number | null }) | null;
};

export type IngredientWithConversions = Ingredient & {
  averagePieceWeightGrams: number | null;
  unitConversions: ConversionRow[];
};

export interface ScaledIngredient {
  recipeId: string;
  recipeNameSnapshot: string;
  recipeIngredientId: string;
  ingredientId: string;
  ingredientNameSnapshot: string;
  canonicalIngredientName: string;
  category: string;
  originalQuantity: number;
  originalUnit: Unit;
  scaledQuantity: number;
  ingredient: Ingredient & { averagePieceWeightGrams: number | null };
}

export interface CalculatedItemSource {
  recipeId: string;
  recipeNameSnapshot: string;
  recipeIngredientId: string | null;
  originalQuantity: number;
  originalUnitId: string;
  originalUnitNameSnapshot: string;
  scaledQuantity: number;
  scaledUnitId: string;
  scaledUnitNameSnapshot: string;
  conversionApplied: boolean;
  conversionConfidence: number;
  warning: string | null;
}

export interface CalculatedItem {
  ingredientId: string;
  ingredientNameSnapshot: string;
  canonicalIngredientName: string;
  category: string;
  totalQuantity: number;
  unitId: string;
  unitNameSnapshot: string;
  displayQuantity: number;
  displayUnit: string;
  confidence: GroceryConfidenceLevel;
  mergeStatus: GroceryMergeStatusValue;
  notes: string | null;
  sources: CalculatedItemSource[];
  sortOrder?: number;
}

export interface CalculationWarning {
  ingredientId: string | null;
  message: string;
  severity: WarningSeverityLevel;
  sourceRecipeId: string | null;
  sourceRecipeName: string | null;
}

export interface CalculationOutput {
  items: CalculatedItem[];
  warnings: CalculationWarning[];
}
