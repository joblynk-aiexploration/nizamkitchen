import { Prisma, type GroceryListSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ScaledIngredient, CalculationOutput } from "@/lib/grocery";
import { calculateGroceryItems } from "./grocery-calculator";
import { createAuditEvent } from "@/server/audit";
import type { GroceryListCreateInput } from "@/lib/validation/grocery";

const RECIPE_INCLUDE = {
  cuisine: true,
  ingredients: {
    include: {
      ingredient: { include: { unitConversions: { include: { fromUnit: true, toUnit: true, ingredient: true } } } },
      unit: true,
    },
    orderBy: { displayOrder: "asc" as const },
  },
} as const;

export async function generateGroceryList(params: {
  organizationId: string;
  countryCode: string | null;
  createdById: string;
  input: GroceryListCreateInput;
  sourceType?: GroceryListSourceType;
  mealPlanId?: string | null;
  plannedStartDate?: Date | null;
  plannedEndDate?: Date | null;
  recipeTimeline?: Array<{
    recipeId: string;
    targetServings: number;
    mealSlot?: string | null;
    plannedDate?: Date | null;
  }>;
}) {
  const {
    organizationId,
    countryCode,
    createdById,
    input,
    sourceType = "recipes",
    mealPlanId = null,
    plannedStartDate = null,
    plannedEndDate = null,
    recipeTimeline,
  } = params;

  // Fetch all units and global conversions
  const [units, globalConversions, recipes] = await Promise.all([
    prisma.unit.findMany(),
    prisma.unitConversion.findMany({
      where: { ingredientId: null },
      include: { fromUnit: true, toUnit: true, ingredient: true },
    }),
    prisma.recipe.findMany({
      where: { id: { in: [...new Set(input.recipes.map((r) => r.recipeId))] } },
      include: RECIPE_INCLUDE,
    }),
  ]);

  // Collect all ingredient IDs for fetching ingredient-specific conversions
  const ingredientIds = [...new Set(
    recipes.flatMap((r) => r.ingredients.map((ri) => ri.ingredientId)),
  )];

  const ingredientConversions = ingredientIds.length > 0
    ? await prisma.unitConversion.findMany({
        where: { ingredientId: { in: ingredientIds } },
        include: { fromUnit: true, toUnit: true, ingredient: true },
      })
    : [];

  const allConversions = [...globalConversions, ...ingredientConversions];

  // Build scaled ingredient entries
  const scaledIngredients: ScaledIngredient[] = [];
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  for (const recipeInput of input.recipes) {
    const recipe = recipesById.get(recipeInput.recipeId);
    if (!recipe) {
      throw new Error(`Recipe ${recipeInput.recipeId} not found for grocery generation.`);
    }

    const targetServings = recipeInput.targetServings;
    const scaleFactor = targetServings / recipe.servings;

    for (const ri of recipe.ingredients) {
      if (ri.isOptional) continue;
      scaledIngredients.push({
        recipeId: recipe.id,
        recipeNameSnapshot: recipe.name,
        recipeIngredientId: ri.id,
        ingredientId: ri.ingredientId,
        ingredientNameSnapshot: ri.ingredient.name,
        canonicalIngredientName: ri.ingredient.canonicalName,
        category: ri.ingredient.category,
        originalQuantity: ri.quantity,
        originalUnit: ri.unit,
        scaledQuantity: ri.quantity * scaleFactor,
        ingredient: ri.ingredient,
      });
    }
  }

  // Run pure calculator
  const calculation: CalculationOutput = calculateGroceryItems({
    scaledIngredients,
    conversions: allConversions,
    units,
  });

  // Persist grocery list + items + sources + warnings in a transaction
  const groceryList = await prisma.$transaction(async (tx) => {
    const list = await tx.groceryList.create({
      data: {
        organizationId,
        countryCode,
        createdById,
        mealPlanId,
        name: input.name,
        notes: input.notes ?? null,
        householdSize: input.householdSize ?? null,
        sourceType,
        status: "draft",
        plannedStartDate,
        plannedEndDate,
        recipes: {
          create: input.recipes.map((r, index) => {
            const recipe = recipesById.get(r.recipeId)!;
            const timelineItem = recipeTimeline?.[index];
            return {
              recipeId: r.recipeId,
              recipeNameSnapshot: recipe.name,
              originalServings: recipe.servings,
              targetServings: r.targetServings,
              scaleFactor: r.targetServings / recipe.servings,
              mealSlot: r.mealSlot ?? null,
              plannedDate: timelineItem?.plannedDate ?? null,
            };
          }),
        },
        items: {
          create: calculation.items.map((item, idx) => ({
            ingredientId: item.ingredientId,
            ingredientNameSnapshot: item.ingredientNameSnapshot,
            canonicalIngredientName: item.canonicalIngredientName,
            category: item.category,
            totalQuantity: item.totalQuantity,
            unitId: item.unitId,
            unitNameSnapshot: item.unitNameSnapshot,
            displayQuantity: item.displayQuantity,
            displayUnit: item.displayUnit,
            confidence: item.confidence,
            mergeStatus: item.mergeStatus,
            notes: item.notes,
            sortOrder: idx,
            sources: {
              create: item.sources.map((s) => ({
                recipeId: s.recipeId,
                recipeNameSnapshot: s.recipeNameSnapshot,
                recipeIngredientId: s.recipeIngredientId,
                originalQuantity: s.originalQuantity,
                originalUnitId: s.originalUnitId,
                originalUnitNameSnapshot: s.originalUnitNameSnapshot,
                scaledQuantity: s.scaledQuantity,
                scaledUnitId: s.scaledUnitId,
                scaledUnitNameSnapshot: s.scaledUnitNameSnapshot,
                conversionApplied: s.conversionApplied,
                conversionConfidence: s.conversionConfidence,
                warning: s.warning,
              })),
            },
          })),
        },
        warnings: {
          create: calculation.warnings.map((w) => ({
            ingredientId: w.ingredientId,
            message: w.message,
            severity: w.severity,
            sourceRecipeId: w.sourceRecipeId,
            sourceRecipeName: w.sourceRecipeName,
          })),
        },
      },
    });
    return list;
  });

  await createAuditEvent({
    actorUserId: createdById,
    organizationId,
    countryCode,
    action: "grocery_list.created",
    targetType: "grocery_list",
    targetId: groceryList.id,
    details: {
      name: input.name,
      recipeCount: input.recipes.length,
      itemCount: calculation.items.length,
      sourceType,
      mealPlanId,
    } as Prisma.InputJsonValue,
  });

  return groceryList;
}
