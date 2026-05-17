import { prisma } from "@/lib/prisma";
import { aiProviderOutputSchema } from "@/lib/validation/video";
import type { AIProviderOutput } from "@/lib/validation/video";

export type NormalizedIngredient = {
  ingredientName: string;
  normalizedIngredientName: string;
  ingredientId: string | null;
  quantity: number | null;
  unitId: string | null;
  unitName: string | null;
  preparationNote: string | null;
  timestampStartSeconds: number | null;
  timestampEndSeconds: number | null;
  confidence: AIProviderOutput["confidence"];
  evidenceText: string | null;
  evidenceFrameTimestamp: number | null;
  notes: string | null;
  displayOrder: number;
};

export type NormalizedStep = {
  stepNumber: number;
  title: string | null;
  description: string;
  timestampStartSeconds: number | null;
  timestampEndSeconds: number | null;
  durationSeconds: number | null;
  temperature: string | null;
  technique: string | null;
  confidence: AIProviderOutput["confidence"];
  evidenceText: string | null;
  evidenceFrameTimestamp: number | null;
  notes: string | null;
  displayOrder: number;
};

export type NormalizedDifference = {
  differenceType: string;
  title: string;
  description: string;
  severity: string;
};

export type NormalizedAnalysis = {
  title: string;
  summary: string | null;
  confidence: AIProviderOutput["confidence"];
  ingredients: NormalizedIngredient[];
  steps: NormalizedStep[];
  differences: NormalizedDifference[];
};

// Validate raw AI JSON and normalize — throws if invalid
export async function normalizeAIOutput(raw: unknown): Promise<NormalizedAnalysis> {
  // Strict validation — rejects non-conforming AI output
  const parsed = aiProviderOutputSchema.parse(raw);

  // Batch-load units for name matching
  const unitNames = [...new Set(
    parsed.ingredients
      .map((i) => i.unitName)
      .filter((n): n is string => !!n)
      .map((n) => n.toLowerCase()),
  )];

  const matchedUnits = unitNames.length > 0
    ? await prisma.unit.findMany({
        where: { name: { in: unitNames, mode: "insensitive" } },
      })
    : [];

  const unitByName = new Map(matchedUnits.map((u) => [u.name.toLowerCase(), u]));

  // Batch-load ingredients for name matching (best-effort, leave null when uncertain)
  const ingredientNames = [...new Set(
    parsed.ingredients
      .map((i) => i.ingredientName.trim().toLowerCase()),
  )];

  const matchedIngredients = ingredientNames.length > 0
    ? await prisma.ingredient.findMany({
        where: {
          isActive: true,
          isGlobal: true,
          canonicalName: { in: ingredientNames, mode: "insensitive" },
        },
      })
    : [];

  const ingredientByName = new Map(matchedIngredients.map((i) => [i.canonicalName.toLowerCase(), i]));

  const ingredients: NormalizedIngredient[] = parsed.ingredients.map((ing, idx) => {
    const normalized = ing.ingredientName.trim().toLowerCase();
    const matchedIngredient = ingredientByName.get(normalized) ?? null;
    const matchedUnit = ing.unitName ? (unitByName.get(ing.unitName.toLowerCase()) ?? null) : null;

    // Validate timestamp range
    const tsStart = ing.timestampStartSeconds ?? null;
    let tsEnd = ing.timestampEndSeconds ?? null;
    if (tsStart !== null && tsEnd !== null && tsEnd < tsStart) {
      tsEnd = null; // reject invalid range
    }

    return {
      ingredientName: ing.ingredientName.trim(),
      normalizedIngredientName: normalized,
      ingredientId: matchedIngredient?.id ?? null,
      quantity: ing.quantity ?? null,
      unitId: matchedUnit?.id ?? null,
      unitName: ing.unitName ?? null,
      preparationNote: ing.preparationNote ?? null,
      timestampStartSeconds: tsStart,
      timestampEndSeconds: tsEnd,
      confidence: ing.confidence,
      evidenceText: ing.evidenceText ?? null,
      evidenceFrameTimestamp: null,
      notes: ing.notes ?? null,
      displayOrder: idx,
    };
  });

  const steps: NormalizedStep[] = parsed.steps.map((step, idx) => {
    const tsStart = step.timestampStartSeconds ?? null;
    let tsEnd = step.timestampEndSeconds ?? null;
    if (tsStart !== null && tsEnd !== null && tsEnd < tsStart) {
      tsEnd = null;
    }

    return {
      stepNumber: step.stepNumber,
      title: step.title ?? null,
      description: step.description,
      timestampStartSeconds: tsStart,
      timestampEndSeconds: tsEnd,
      durationSeconds: step.durationSeconds ?? null,
      temperature: step.temperature ?? null,
      technique: step.technique ?? null,
      confidence: step.confidence,
      evidenceText: step.evidenceText ?? null,
      evidenceFrameTimestamp: null,
      notes: step.notes ?? null,
      displayOrder: idx,
    };
  });

  const differences: NormalizedDifference[] = parsed.differencesFromWrittenRecipe.map((d) => ({
    differenceType: d.differenceType,
    title: d.title,
    description: d.description,
    severity: d.severity,
  }));

  return {
    title: parsed.title,
    summary: parsed.summary ?? null,
    confidence: parsed.confidence,
    ingredients,
    steps,
    differences,
  };
}
