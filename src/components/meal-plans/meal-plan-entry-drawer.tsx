"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { BookOpen, Check, Search, X } from "lucide-react";

type RecipeOption = {
  id: string;
  name: string;
  servings: number;
  servingUnit: string;
  cuisineName: string;
  sourceRecipeId?: string | null;
  isUserCustomized?: boolean;
  isFavorite?: boolean;
  spiceLevel?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  createdById?: string | null;
  updatedAt?: string;
};

type GlobalRecipeOption = {
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

function formatUpdatedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CommonMealFields({ mealPlanDayId, defaultServings = "4" }: { mealPlanDayId: string; defaultServings?: string }) {
  return (
    <>
      <input type="hidden" name="status" value="planned" />
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
            defaultValue={defaultServings}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
          />
        </div>
      </div>
    </>
  );
}

export function MealPlanEntryDrawer({
  mealPlanId,
  mealPlanDayId,
  dayLabel,
  dateLabel,
  recipes,
  globalRecipes = [],
  currentUserId,
  action,
  globalAction,
}: {
  mealPlanId: string;
  mealPlanDayId: string;
  dayLabel: string;
  dateLabel: string;
  recipes: RecipeOption[];
  globalRecipes?: GlobalRecipeOption[];
  currentUserId?: string;
  action: (formData: FormData) => void | Promise<void>;
  globalAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [spiceFilter, setSpiceFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const deferredQuery = useDeferredValue(query);
  const deferredGlobalQuery = useDeferredValue(globalQuery);

  const cuisines = useMemo(
    () => Array.from(new Set(recipes.map((recipe) => recipe.cuisineName))).sort((a, b) => a.localeCompare(b)),
    [recipes],
  );
  const spiceLevels = useMemo(
    () => Array.from(new Set(recipes.map((recipe) => recipe.spiceLevel).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [recipes],
  );

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return recipes.filter((recipe) =>
      (!normalizedQuery ||
        [recipe.name, recipe.cuisineName].some((value) => value.toLowerCase().includes(normalizedQuery))) &&
      (!cuisineFilter || recipe.cuisineName === cuisineFilter) &&
      (!spiceFilter || recipe.spiceLevel === spiceFilter) &&
      (!sourceFilter ||
        (sourceFilter === "customized" && Boolean(recipe.sourceRecipeId || recipe.isUserCustomized)) ||
        (sourceFilter === "created_by_me" && Boolean(currentUserId) && recipe.createdById === currentUserId) ||
        (sourceFilter === "favorite" && Boolean(recipe.isFavorite))) &&
      (!timeFilter ||
        (timeFilter === "30" && (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) <= 30) ||
        (timeFilter === "60" && (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) <= 60) ||
        (timeFilter === "90" && (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) <= 90)),
    );
  }, [cuisineFilter, currentUserId, deferredQuery, recipes, sourceFilter, spiceFilter, timeFilter]);

  const filteredGlobalRecipes = useMemo(() => {
    const normalizedQuery = deferredGlobalQuery.trim().toLowerCase();
    if (!normalizedQuery) return globalRecipes;
    return globalRecipes.filter((recipe) =>
      [recipe.name, recipe.cuisineName].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [deferredGlobalQuery, globalRecipes]);

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
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">My Recipes</p>
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

            <div className="space-y-8 px-6 py-5">
              <form action={action} onSubmit={() => setOpen(false)} className="space-y-6">
                <input type="hidden" name="mealPlanId" value={mealPlanId} />
                <input type="hidden" name="mealPlanDayId" value={mealPlanDayId} />

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-ink)]">Choose from My Recipes</h3>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">Only household-owned recipes appear here.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/recipes/my" className="rounded-full border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-ink)]">
                        My Recipes
                      </Link>
                      <Link href="/recipes/new" className="rounded-full border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-ink)]">
                        Create New Recipe
                      </Link>
                    </div>
                  </div>

                  <div className="relative mt-4">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search My Recipes"
                      className="w-full rounded-2xl border border-[var(--color-border)] px-11 py-3 text-sm outline-none transition focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <select
                      value={cuisineFilter}
                      onChange={(event) => setCuisineFilter(event.target.value)}
                      aria-label="Filter My Recipes by cuisine"
                      className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                    >
                      <option value="">All cuisines</option>
                      {cuisines.map((cuisine) => (
                        <option key={cuisine} value={cuisine}>
                          {cuisine}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      aria-label="Filter My Recipes by source"
                      className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                    >
                      <option value="">All sources</option>
                      <option value="favorite">Favorites</option>
                      <option value="customized">Customized from global</option>
                      <option value="created_by_me">Created by me</option>
                    </select>
                    <select
                      value={spiceFilter}
                      onChange={(event) => setSpiceFilter(event.target.value)}
                      aria-label="Filter My Recipes by spice level"
                      className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm capitalize text-[var(--color-ink)]"
                    >
                      <option value="">All spice levels</option>
                      {spiceLevels.map((spiceLevel) => (
                        <option key={spiceLevel} value={spiceLevel}>
                          {spiceLevel.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      value={timeFilter}
                      onChange={(event) => setTimeFilter(event.target.value)}
                      aria-label="Filter My Recipes by prep and cook time"
                      className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                    >
                      <option value="">Any time</option>
                      <option value="30">30 min or less</option>
                      <option value="60">60 min or less</option>
                      <option value="90">90 min or less</option>
                    </select>
                  </div>

                  {recipes.length === 0 ? (
                    <div className="mt-4 rounded-3xl border border-dashed border-[var(--color-border)] bg-slate-50 p-5">
                      <BookOpen className="h-5 w-5 text-[var(--color-primary)]" />
                      <h4 className="mt-3 text-sm font-semibold text-[var(--color-ink)]">You do not have any recipes in My Recipes yet.</h4>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        Browse Global Recipes, import from the recipe library, or create a new recipe. Global templates are copied into your household before they can be used here.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href="/recipes" className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                          Browse Global Recipes
                        </Link>
                        <Link href="/recipes/new" className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]">
                          Create New Recipe
                        </Link>
                        <Link href="/recipes" className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]">
                          Import from Recipe Library
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto pr-1">
                      {filteredRecipes.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
                          No My Recipes match this search.
                        </div>
                      ) : (
                        filteredRecipes.map((recipe) => {
                          const updatedAt = formatUpdatedAt(recipe.updatedAt);
                          return (
                            <label key={recipe.id} className="group flex cursor-pointer gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40">
                              <input type="radio" name="recipeId" value={recipe.id} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-[var(--color-ink)]">{recipe.name}</span>
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-800 ring-1 ring-emerald-200">My Recipe</span>
                                  {recipe.sourceRecipeId || recipe.isUserCustomized ? (
                                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[0.68rem] font-semibold text-teal-800 ring-1 ring-teal-200">Customized</span>
                                  ) : null}
                                  {recipe.isFavorite ? (
                                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[0.68rem] font-semibold text-amber-800 ring-1 ring-amber-200">Favorite</span>
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                                  {recipe.cuisineName} · {recipe.servings} {recipe.servingUnit}
                                  {recipe.spiceLevel ? ` · ${recipe.spiceLevel.replace(/_/g, " ")}` : ""}
                                  {recipe.prepMinutes !== undefined && recipe.cookMinutes !== undefined
                                    ? ` · ${recipe.prepMinutes + recipe.cookMinutes} min`
                                    : ""}
                                  {updatedAt ? ` · Updated ${updatedAt}` : ""}
                                </span>
                              </span>
                              <Check className="mt-1 h-4 w-4 text-emerald-600 opacity-0 transition group-has-[:checked]:opacity-100" />
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <CommonMealFields mealPlanDayId={mealPlanDayId} />

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

                <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-[var(--color-muted)]">
                  Recipe-backed entries feed the grocery engine from your household recipe copy. Custom meals stay on the plan but are not included in grocery calculations.
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

              {globalAction ? (
                <form action={globalAction} onSubmit={() => setOpen(false)} className="space-y-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5">
                  <input type="hidden" name="mealPlanId" value={mealPlanId} />
                  <input type="hidden" name="mealPlanDayId" value={mealPlanDayId} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Add from Global Recipes</p>
                    <h3 className="mt-2 text-base font-semibold text-[var(--color-ink)]">Copy a global template, then use it here</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                      This creates or reuses a household-owned copy in My Recipes. The global recipe stays unchanged.
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={globalQuery}
                      onChange={(event) => setGlobalQuery(event.target.value)}
                      placeholder="Search global templates"
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <select
                    name="globalRecipeId"
                    required
                    defaultValue=""
                    className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                  >
                    <option value="">Choose a global recipe template</option>
                    {filteredGlobalRecipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.name} · {recipe.cuisineName} · {recipe.servings} {recipe.servingUnit}
                      </option>
                    ))}
                  </select>

                  <CommonMealFields mealPlanDayId={`global-${mealPlanDayId}`} />

                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor={`global-notes-${mealPlanDayId}`}>
                      Notes
                    </label>
                    <textarea
                      id={`global-notes-${mealPlanDayId}`}
                      name="notes"
                      rows={2}
                      className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm"
                      placeholder="Optional planning note"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href="/recipes" className="text-sm font-semibold text-[var(--color-primary)]">
                      Browse Global Recipes
                    </Link>
                    <button
                      type="submit"
                      className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm"
                    >
                      Add to My Recipes and use
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
