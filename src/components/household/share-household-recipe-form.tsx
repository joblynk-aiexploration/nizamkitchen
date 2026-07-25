"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";

type RecipeOption = {
  id: string;
  name: string;
  cuisineName: string;
  servings: number;
  servingUnit: string;
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
};

type MemberOption = {
  userId: string;
  fullName: string;
  email: string;
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function ShareHouseholdRecipeForm({
  recipes,
  members,
  action,
}: {
  recipes: RecipeOption[];
  members: MemberOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === recipeId) ?? recipes[0] ?? null,
    [recipeId, recipes],
  );

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.8fr)_180px_auto] lg:items-end">
      <SelectInput
        label="Recipe to share"
        name="recipeId"
        required
        value={recipeId}
        onChange={(event) => setRecipeId(event.target.value)}
        options={recipes.map((recipe) => ({
          value: recipe.id,
          label: `${recipe.name} - ${recipe.cuisineName}`,
        }))}
      />

      <SelectInput
        label="Share with"
        name="recipientUserId"
        options={[
          { value: "", label: "Whole family" },
          ...members.map((member) => ({
            value: member.userId,
            label: `${member.fullName} - ${member.email}`,
          })),
        ]}
      />

      <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
        <span>Servings</span>
        <input
          name="targetServings"
          type="number"
          min={1}
          max={100}
          defaultValue={selectedRecipe?.servings ?? 4}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25"
        />
      </label>

      <Button type="submit" disabled={!selectedRecipe}>Share recipe</Button>

      {selectedRecipe ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm lg:col-span-4">
          <p className="font-semibold text-[var(--color-ink)]">{selectedRecipe.name}</p>
          <p className="mt-1 text-[var(--color-muted)]">
            Base recipe: {selectedRecipe.servings} {selectedRecipe.servingUnit}
            {selectedRecipe.servings === 1 ? "" : "s"} · Prep {formatMinutes(selectedRecipe.prepMinutes)} · Cook{" "}
            {formatMinutes(selectedRecipe.cookMinutes)} · Total {formatMinutes(selectedRecipe.totalMinutes)}
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)] lg:col-span-4">
          No recipes are available to share yet.
        </p>
      )}
    </form>
  );
}
