// formatGroceryQuantity(1500, "gram") → "1.5 kg"
// formatGroceryQuantity(250, "gram") → "250 g"
// formatGroceryQuantity(1200, "milliliter") → "1.2 L"
// formatGroceryQuantity(3, "piece") → "3"
// formatGroceryQuantity(0.5, "kilogram") → "500 g" (normalize down if below 1 of a large unit)

export function formatGroceryQuantity(quantity: number, unitCode: string, unitSymbol: string | null): string {
  const q = Math.round(quantity * 100) / 100;
  // If gram ≥ 1000: show as kg
  if (unitCode === "gram" && q >= 1000) return `${(q / 1000).toFixed(q % 1000 === 0 ? 0 : 1)} kg`;
  // If ml ≥ 1000: show as L
  if (unitCode === "milliliter" && q >= 1000) return `${(q / 1000).toFixed(q % 1000 === 0 ? 0 : 1)} L`;
  // Count types: show as integer or 0.5 fractions
  if (["piece", "count", "clove", "bunch"].includes(unitCode)) {
    return Number.isInteger(q) ? String(q) : q.toFixed(1);
  }
  const symbol = unitSymbol ?? unitCode;
  return `${Number.isInteger(q) ? q : q.toFixed(1)} ${symbol}`;
}

export function getDisplayUnit(unitCode: string, quantity: number): string {
  if (unitCode === "gram" && quantity >= 1000) return "kg";
  if (unitCode === "milliliter" && quantity >= 1000) return "L";
  if (unitCode === "gram") return "g";
  if (unitCode === "milliliter") return "ml";
  if (unitCode === "kilogram") return "kg";
  if (unitCode === "liter") return "L";
  return unitCode;
}

export function confidenceBadgeProps(confidence: string): { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" } {
  switch (confidence) {
    case "exact": return { label: "Exact", tone: "success" };
    case "high": return { label: "High", tone: "success" };
    case "medium": return { label: "Est.", tone: "warning" };
    case "low": return { label: "Low", tone: "danger" };
    default: return { label: "?", tone: "neutral" };
  }
}

export function mergeBadgeProps(status: string): { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" } {
  switch (status) {
    case "merged": return { label: "Merged", tone: "info" };
    case "separate": return { label: "Single", tone: "neutral" };
    case "needs_review": return { label: "Review", tone: "warning" };
    case "conversion_failed": return { label: "Failed", tone: "danger" };
    default: return { label: status, tone: "neutral" };
  }
}

export function sortOrderForCategory(category: string): number {
  const ORDER: Record<string, number> = {
    vegetable: 1, fruit: 2, legume: 3, grain: 4, meat: 5, poultry: 5,
    seafood: 6, dairy: 7, egg: 8, oil: 9, fat: 9, nut: 10, seed: 10,
    spice: 11, herb: 12, condiment: 13, sweetener: 14, beverage: 15,
    other: 90,
  };
  return ORDER[category] ?? 50;
}
