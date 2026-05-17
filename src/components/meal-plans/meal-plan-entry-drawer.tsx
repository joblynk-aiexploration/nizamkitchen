"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

type RecipeOption = {
  id: string;
  name: string;
  servings: number;
  servingUnit: string;
  cuisineName: string;
};

const mealTypes = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "dessert", label: "Dessert" },
  { value: "side", label: "Side" },
  { value: "prep", label: "Prep" },
] as const;

export function MealPlanEntryDrawer({
  mealPlanId,
  mealPlanDayId,
  dayLabel,
  dateLabel,
  recipes,
  action,
}: {
  mealPlanId: string;
  mealPlanDayId: string;
  dayLabel: string;
  dateLabel: string;
  recipes: RecipeOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return recipes;
    return recipes.filter((recipe) =>
      [recipe.name, recipe.cuisineName].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [deferredQuery, recipes]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-amber-50"
      >
        Add meal
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/45">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recipe search</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{dayLabel}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{dateLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[var(--color-border)] p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Close meal drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search recipes or cuisines"
                  className="w-full rounded-2xl border border-[var(--color-border)] px-11 py-3 text-sm outline-none transition focus:border-[var(--color-primary)]"
                />
              </div>

              <form
                action={action}
                onSubmit={() => setOpen(false)}
                className="mt-6 space-y-6"
              >
                <input type="hidden" name="mealPlanId" value={mealPlanId} />
                <input type="hidden" name="mealPlanDayId" value={mealPlanDayId} />

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor={`recipe-${mealPlanDayId}`}>
                    Recipe
                  </label>
                  <select
                    id={`recipe-${mealPlanDayId}`}
                    name="recipeId"
                    className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    defaultValue=""
                  >
                    <option value="">Choose a recipe (or leave blank for custom meal)</option>
                    {filteredRecipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.name} · {recipe.cuisineName} · {recipe.servings} {recipe.servingUnit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor={`meal-type-${mealPlanDayId}`}>
                      Meal slot
                    </label>
                    <select
                      id={`meal-type-${mealPlanDayId}`}
                      name="mealType"
                      defaultValue="dinner"
                      className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    >
                      {mealTypes.map((mealType) => (
                        <option key={mealType.value} value={mealType.value}>
                          {mealType.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor={`servings-${mealPlanDayId}`}>
                      Target servings
                    </label>
                    <input
                      id={`servings-${mealPlanDayId}`}
                      name="targetServings"
                      type="number"
                      min="1"
                      max="100"
                      defaultValue="4"
                      className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor={`custom-${mealPlanDayId}`}>
                    Custom meal name
                  </label>
                  <input
                    id={`custom-${mealPlanDayId}`}
                    name="customMealName"
                    type="text"
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    placeholder="Use for takeout, leftovers, prep, or custom ideas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor={`notes-${mealPlanDayId}`}>
                    Notes
                  </label>
                  <textarea
                    id={`notes-${mealPlanDayId}`}
                    name="notes"
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    placeholder="Marinate ahead, freezer pull, school lunch prep..."
                  />
                </div>

                <div className="rounded-3xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
                  Pick a recipe to keep grocery generation connected. Custom meals stay visible on the plan but are intentionally ignored when the grocery list is generated.
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    Save meal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
