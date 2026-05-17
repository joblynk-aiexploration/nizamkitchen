import type { Ingredient, IngredientAlias } from "@prisma/client";

type IngredientWithAliases = Ingredient & { aliases: IngredientAlias[] };

export type AliasMatchResult =
  | { found: true; ingredient: IngredientWithAliases; confidence: number; matchedAlias: string }
  | { found: false };

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export function matchIngredientByAlias(
  query: string,
  ingredients: IngredientWithAliases[],
): AliasMatchResult {
  const q = normalize(query);

  // Exact canonical name match — highest confidence
  for (const ingredient of ingredients) {
    if (normalize(ingredient.canonicalName) === q) {
      return { found: true, ingredient, confidence: 1.0, matchedAlias: ingredient.canonicalName };
    }
  }

  // Exact primary name match
  for (const ingredient of ingredients) {
    if (normalize(ingredient.name) === q) {
      return { found: true, ingredient, confidence: 1.0, matchedAlias: ingredient.name };
    }
  }

  // Exact alias match — use the alias confidence
  for (const ingredient of ingredients) {
    for (const alias of ingredient.aliases) {
      if (normalize(alias.alias) === q) {
        return {
          found: true,
          ingredient,
          confidence: alias.confidence,
          matchedAlias: alias.alias,
        };
      }
    }
  }

  // Prefix match (e.g. "onions" matches "onion")
  for (const ingredient of ingredients) {
    if (normalize(ingredient.canonicalName).startsWith(q) || q.startsWith(normalize(ingredient.canonicalName))) {
      return { found: true, ingredient, confidence: 0.85, matchedAlias: ingredient.canonicalName };
    }
    for (const alias of ingredient.aliases) {
      const a = normalize(alias.alias);
      if (a.startsWith(q) || q.startsWith(a)) {
        return {
          found: true,
          ingredient,
          confidence: alias.confidence * 0.85,
          matchedAlias: alias.alias,
        };
      }
    }
  }

  return { found: false };
}

export function buildIngredientSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
