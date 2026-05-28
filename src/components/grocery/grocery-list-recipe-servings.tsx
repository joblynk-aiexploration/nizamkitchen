"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type GroceryRecipeOption = {
  id: string;
  name: string;
  defaultServings: number;
  servingUnit: string;
  cuisineName: string;
};

export function GroceryListRecipeServings({ recipes }: { recipes: GroceryRecipeOption[] }) {
  const [averagePeople, setAveragePeople] = useState("");
  const [servingsByRecipeId, setServingsByRecipeId] = useState<Record<string, string>>({});

  function applyAveragePeople() {
    const value = Number(averagePeople);
    if (!Number.isFinite(value) || value < 1) return;
    const normalized = String(Math.floor(value));
    setServingsByRecipeId(Object.fromEntries(recipes.map((recipe) => [recipe.id, normalized])));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-emerald-50/50 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="averagePeople">
            Average people
            <span className="mt-1 block text-xs font-normal text-[var(--color-muted)]">
              Enter the number of people you are cooking for, then apply it to every recipe.
            </span>
            <input
              id="averagePeople"
              type="number"
              min="1"
              max="200"
              inputMode="numeric"
              value={averagePeople}
              onChange={(event) => setAveragePeople(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              placeholder="Example: 4"
            />
          </label>
          <Button type="button" onClick={applyAveragePeople} className="justify-center">
            Apply to all recipes
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-slate-50 px-4 py-3"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-ink)]">{recipe.name}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {recipe.cuisineName} · Default: {recipe.defaultServings} {recipe.servingUnit}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor={`recipe_${recipe.id}_servings`}
                className="whitespace-nowrap text-xs text-[var(--color-muted)]"
              >
                Target servings
              </label>
              <input
                id={`recipe_${recipe.id}_servings`}
                name={`recipe_${recipe.id}_servings`}
                type="number"
                min="1"
                max="200"
                value={servingsByRecipeId[recipe.id] ?? ""}
                onChange={(event) =>
                  setServingsByRecipeId((current) => ({
                    ...current,
                    [recipe.id]: event.target.value,
                  }))
                }
                placeholder={String(recipe.defaultServings)}
                className="w-20 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-center text-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
