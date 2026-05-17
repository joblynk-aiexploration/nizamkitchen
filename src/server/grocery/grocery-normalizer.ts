import type { Unit, UnitConversion, Ingredient } from "@prisma/client";
import { convertUnit } from "@/lib/units";

type ConversionRow = UnitConversion & {
  fromUnit: Unit;
  toUnit: Unit;
  ingredient: (Ingredient & { averagePieceWeightGrams: number | null }) | null;
};

export type NormalizeResult =
  | { ok: true; quantity: number; unit: Unit; confidence: number; conversionApplied: boolean }
  | { ok: false; reason: string; quantity: number; unit: Unit };

export function findBaseUnit(unitType: string, units: Unit[]): Unit | undefined {
  return units.find((u) => u.type === unitType && u.isBaseUnit);
}

export function normalizeToBaseUnit(
  quantity: number,
  unit: Unit,
  units: Unit[],
  conversions: ConversionRow[],
  ingredient?: (Ingredient & { averagePieceWeightGrams: number | null }) | null,
): NormalizeResult {
  const baseUnit = findBaseUnit(unit.type, units);
  if (!baseUnit) {
    return { ok: false, reason: `No base unit for type "${unit.type}"`, quantity, unit };
  }
  if (unit.id === baseUnit.id) {
    return { ok: true, quantity, unit: baseUnit, confidence: 1.0, conversionApplied: false };
  }
  const result = convertUnit({ quantity, fromUnit: unit, toUnit: baseUnit, conversions, ingredient });
  if (result.ok) {
    return { ok: true, quantity: result.value, unit: baseUnit, confidence: result.confidence, conversionApplied: true };
  }
  return { ok: false, reason: result.reason, quantity, unit };
}

export function confidenceFromNumber(n: number): import("@/lib/grocery").GroceryConfidenceLevel {
  if (n >= 1.0) return "exact";
  if (n >= 0.95) return "high";
  if (n >= 0.8) return "medium";
  if (n > 0) return "low";
  return "unknown";
}
