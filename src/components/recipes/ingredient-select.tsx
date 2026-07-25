"use client";

import { useMemo, useState } from "react";
import type { IngredientCategory } from "@prisma/client";

type IngredientOption = {
  id: string;
  name: string;
  canonicalName: string;
  category: IngredientCategory;
  defaultUnitId?: string | null;
  aliases?: { alias: string }[];
};

export type IngredientSearchOption = IngredientOption & {
  displayName: string;
  matchedAlias?: string | null;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  vegetable: "Vegetables",
  fruit: "Fruit",
  meat: "Meat",
  poultry: "Poultry",
  seafood: "Seafood",
  dairy: "Dairy",
  grain: "Grains",
  lentil: "Lentils",
  spice: "Spices",
  herb: "Herbs",
  oil: "Oils",
  condiment: "Condiments",
  nut: "Nuts",
  sweetener: "Sweeteners",
  beverage: "Beverages",
  packaged: "Packaged",
  other: "Other",
};

function normalizeIngredientSearch(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export function getIngredientDisplayName(ingredient: Pick<IngredientOption, "name">) {
  return ingredient.name;
}

export function getMatchedIngredientAlias(ingredient: Pick<IngredientOption, "name" | "canonicalName" | "aliases">, query: string) {
  const normalized = normalizeIngredientSearch(query);
  if (!normalized) return null;

  const canonicalNames = [ingredient.name, ingredient.canonicalName].map(normalizeIngredientSearch);
  if (canonicalNames.some((name) => name.includes(normalized) || normalized.includes(name))) return null;

  return ingredient.aliases
    ?.map((alias) => alias.alias)
    .find((alias) => {
      const normalizedAlias = normalizeIngredientSearch(alias);
      return normalizedAlias.includes(normalized) || normalized.includes(normalizedAlias);
    }) ?? null;
}

export function filterIngredientOptions(ingredients: IngredientOption[], query: string): IngredientSearchOption[] {
  const normalized = normalizeIngredientSearch(query);
  const options = ingredients.map((ingredient) => ({
    ...ingredient,
    displayName: getIngredientDisplayName(ingredient),
    matchedAlias: getMatchedIngredientAlias(ingredient, query),
  }));

  if (!normalized) return options.slice(0, 80);

  return options
    .filter((ingredient) => {
      const haystack = [
        ingredient.name,
        ingredient.canonicalName,
        CATEGORY_LABELS[ingredient.category],
        ...(ingredient.aliases?.map((alias) => alias.alias) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, 80);
}

export function IngredientSelect({
  ingredients,
  name = "ingredientId",
  selectedNameInputName,
  defaultValue = "",
  required = true,
}: {
  ingredients: IngredientOption[];
  name?: string;
  selectedNameInputName?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue);

  const selected = ingredients.find((ingredient) => ingredient.id === selectedId);
  const filtered = useMemo(() => filterIngredientOptions(ingredients, query), [ingredients, query]);
  const selectedMatchedAlias = selected ? getMatchedIngredientAlias(selected, query) : null;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selectedId} required={required} />
      {selectedNameInputName && (
        <input type="hidden" name={selectedNameInputName} value={selected ? getIngredientDisplayName(selected) : ""} />
      )}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search approved ingredients"
        className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        aria-label="Search approved ingredients"
      />
      <select
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        aria-label="Approved ingredient"
      >
        <option value="">Choose an approved ingredient</option>
        {filtered.map((ingredient) => (
          <option key={ingredient.id} value={ingredient.id}>
            {ingredient.displayName} - {CATEGORY_LABELS[ingredient.category]}
            {ingredient.matchedAlias ? ` (matched: ${ingredient.matchedAlias})` : ""}
          </option>
        ))}
      </select>
      {selected ? (
        <p className="text-xs text-[var(--color-muted)]">
          Selected canonical ingredient: {getIngredientDisplayName(selected)}
          {selectedMatchedAlias ? ` · Matched: ${selectedMatchedAlias}` : ""}
        </p>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          Ingredients must come from the approved ingredient library so grocery lists can merge and convert units safely.
        </p>
      )}
    </div>
  );
}

export function UnitSelect({
  units,
  name = "unitId",
  defaultValue = "",
  required = true,
}: {
  units: UnitOption[];
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
    >
      <option value="">Choose unit</option>
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.name} ({unit.code})
        </option>
      ))}
    </select>
  );
}
