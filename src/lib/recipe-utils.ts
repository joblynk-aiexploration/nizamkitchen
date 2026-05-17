import type { Recipe, RecipeIngredient, Unit, Ingredient } from "@prisma/client";

type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & {
    unit: Unit;
    ingredient: Ingredient;
  })[];
};

export function getTotalMinutes(recipe: Pick<Recipe, "prepMinutes" | "cookMinutes" | "restMinutes">): number {
  return recipe.prepMinutes + recipe.cookMinutes + (recipe.restMinutes ?? 0);
}

export function formatTotalTime(recipe: Pick<Recipe, "prepMinutes" | "cookMinutes" | "restMinutes">): string {
  const total = getTotalMinutes(recipe);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function isRecipeVisibleToOrganization(
  recipe: Pick<Recipe, "visibility" | "organizationId" | "isPublished">,
  organizationId: string,
): boolean {
  if (!recipe.isPublished) return false;
  if (recipe.visibility === "global") return true;
  if (recipe.visibility === "organization") {
    return recipe.organizationId === organizationId;
  }
  // private recipes are never visible to organizations — only the creator sees them
  return false;
}

export function groupIngredientsBySection(
  ingredients: RecipeWithIngredients["ingredients"],
): Map<string, RecipeWithIngredients["ingredients"]> {
  const sections = new Map<string, RecipeWithIngredients["ingredients"]>();
  for (const ingredient of [...ingredients].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const section = ingredient.section ?? "Main";
    const existing = sections.get(section) ?? [];
    existing.push(ingredient);
    sections.set(section, existing);
  }
  return sections;
}

export function formatQuantity(quantity: number, unit: Unit): string {
  const formatted = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${quantity === 1 ? unit.name : unit.pluralName}`;
}
