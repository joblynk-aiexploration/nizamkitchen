"use client";

import { useMemo, useState } from "react";
import type { IngredientCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { IngredientSelect, UnitSelect } from "@/components/recipes/ingredient-select";

type IngredientOption = {
  id: string;
  name: string;
  canonicalName: string;
  category: IngredientCategory;
  defaultUnitId?: string | null;
  aliases?: { alias: string }[];
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type ExistingRecipeIngredient = {
  id: string;
  ingredientId: string;
  unitId: string;
  quantity: unknown;
  preparationNote?: string | null;
  section?: string | null;
  isOptional?: boolean;
  displayOrder?: number;
  ingredient: {
    name: string;
    canonicalName?: string | null;
    category?: IngredientCategory | null;
  };
  unit: {
    code: string;
    name?: string | null;
    type?: string | null;
  };
};

type Props = {
  recipeIngredients: ExistingRecipeIngredient[];
  ingredients: IngredientOption[];
  units: UnitOption[];
  addIngredientsAction: (formData: FormData) => void | Promise<void>;
  updateIngredientAction: (formData: FormData) => void | Promise<void>;
  deleteIngredientAction: (formData: FormData) => void | Promise<void>;
  moveIngredientAction: (formData: FormData) => void | Promise<void>;
  requestIngredientAction: (formData: FormData) => void | Promise<void>;
};

const SECTION_OPTIONS = [
  "Main",
  "Marinade",
  "Rice",
  "Curry/Base",
  "Masala",
  "Tempering",
  "Garnish",
  "Chutney",
  "Dough",
  "Filling",
  "Syrup",
  "Sauce",
  "Other",
];

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  vegetable: "Vegetable",
  fruit: "Fruit",
  meat: "Meat",
  poultry: "Poultry",
  seafood: "Seafood",
  dairy: "Dairy",
  grain: "Grain",
  lentil: "Lentil",
  spice: "Spice",
  herb: "Herb",
  oil: "Oil",
  condiment: "Condiment",
  nut: "Nut",
  sweetener: "Sweetener",
  beverage: "Beverage",
  packaged: "Packaged",
  other: "Other",
};

function normalizeSection(value?: string | null) {
  return value?.trim() || "Main";
}

function formatQuantity(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) return value.toString();
  return "";
}

function sectionOptionsWithCurrent(current?: string | null) {
  const normalized = normalizeSection(current);
  return SECTION_OPTIONS.includes(normalized) ? SECTION_OPTIONS : [normalized, ...SECTION_OPTIONS];
}

function unitMergeWarning(unit?: { type?: string | null; code?: string | null }) {
  if (!unit?.type) return null;
  if (unit.type === "volume") return "Volume units may need ingredient-specific density before grocery lists can merge into weight.";
  if (unit.type === "count") return "Count units depend on ingredient size and may not merge with weight automatically.";
  if (unit.type === "package" || unit.type === "custom") return "Package and custom units are kept separate unless a safe conversion exists.";
  return null;
}

export function IngredientSectionSelect({
  name = "section",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string | null;
}) {
  const normalized = normalizeSection(defaultValue);
  return (
    <select
      name={name}
      defaultValue={normalized}
      className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
    >
      {sectionOptionsWithCurrent(defaultValue).map((section) => (
        <option key={section} value={section}>
          {section}
        </option>
      ))}
    </select>
  );
}

export function RecipeIngredientsEditor({
  recipeIngredients,
  ingredients,
  units,
  addIngredientsAction,
  updateIngredientAction,
  deleteIngredientAction,
  moveIngredientAction,
  requestIngredientAction,
}: Props) {
  const [rows, setRows] = useState(["ingredient-row-0"]);
  const [nextRowIndex, setNextRowIndex] = useState(1);
  const addRow = () => {
    setRows((current) => [...current, `ingredient-row-${nextRowIndex}`]);
    setNextRowIndex((current) => current + 1);
  };

  const duplicateIngredientIds = useMemo(() => {
    const counts = new Map<string, number>();
    recipeIngredients.forEach((item) => counts.set(item.ingredientId, (counts.get(item.ingredientId) ?? 0) + 1));
    return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
  }, [recipeIngredients]);

  const groupedIngredients = useMemo(() => {
    const groups = new Map<string, ExistingRecipeIngredient[]>();
    recipeIngredients.forEach((item) => {
      const section = normalizeSection(item.section);
      groups.set(section, [...(groups.get(section) ?? []), item]);
    });
    return [...groups.entries()];
  }, [recipeIngredients]);

  const groceryWarnings = recipeIngredients.filter((item) => unitMergeWarning(item.unit)).length;

  return (
    <section>
      <div className="overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--color-border)] bg-gradient-to-r from-emerald-50 via-white to-slate-50 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
                Ingredient Builder
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                Build grocery-ready ingredients
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
                Select approved ingredients and canonical units so meal plans, grocery lists, avoided ingredients, and unit conversions keep working.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addRow}>
              Add ingredient row
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ingredients</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-ink)]">{recipeIngredients.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Groups</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-ink)]">{groupedIngredients.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Conversion notes</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-ink)]">{groceryWarnings}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {recipeIngredients.length ? (
            <div className="space-y-6">
              {groupedIngredients.map(([section, items]) => (
                <div key={section} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{section}</h3>
                    <span className="h-px flex-1 bg-[var(--color-border)]" />
                  </div>

                  <div className="grid gap-4">
                    {items.map((item, index) => {
                      const duplicate = duplicateIngredientIds.has(item.ingredientId);
                      const category = item.ingredient.category ? CATEGORY_LABELS[item.ingredient.category] : "Ingredient";
                      const warning = unitMergeWarning(item.unit);

                      return (
                        <article
                          key={item.id}
                          className="rounded-3xl border border-[var(--color-border)] bg-slate-50/70 p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-[var(--color-border)]">
                                {index + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-[var(--color-ink)]">{item.ingredient.name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="rounded-full bg-white px-2 py-1 ring-1 ring-[var(--color-border)]">{category}</span>
                                  {item.isOptional ? (
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800 ring-1 ring-amber-200">Optional</span>
                                  ) : null}
                                  {duplicate ? (
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800 ring-1 ring-amber-200">
                                      Duplicate ingredient warning
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <form action={moveIngredientAction}>
                                <input type="hidden" name="recipeIngredientId" value={item.id} />
                                <input type="hidden" name="direction" value="up" />
                                <Button type="submit" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs">
                                  Move up
                                </Button>
                              </form>
                              <form action={moveIngredientAction}>
                                <input type="hidden" name="recipeIngredientId" value={item.id} />
                                <input type="hidden" name="direction" value="down" />
                                <Button type="submit" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs">
                                  Move down
                                </Button>
                              </form>
                              <form
                                action={deleteIngredientAction}
                                onSubmit={(event) => {
                                  if (!confirm(`Remove ${item.ingredient.name} from this recipe?`)) event.preventDefault();
                                }}
                              >
                                <input type="hidden" name="recipeIngredientId" value={item.id} />
                                <Button type="submit" variant="danger" className="min-h-9 px-3 py-1.5 text-xs">
                                  Remove
                                </Button>
                              </form>
                            </div>
                          </div>

                          <form action={updateIngredientAction} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,0.9fr)_minmax(0,0.8fr)]">
                            <input type="hidden" name="recipeIngredientId" value={item.id} />
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Ingredient
                              </label>
                              <IngredientSelect ingredients={ingredients} defaultValue={item.ingredientId} />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Qty
                              </label>
                              <input
                                name="quantity"
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                defaultValue={formatQuantity(item.quantity)}
                                className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Unit
                              </label>
                              <UnitSelect units={units} defaultValue={item.unitId} />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Group
                              </label>
                              <IngredientSectionSelect defaultValue={item.section} />
                            </div>
                            <div className="lg:col-span-3">
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Preparation note
                              </label>
                              <input
                                name="preparationNote"
                                type="text"
                                defaultValue={item.preparationNote ?? ""}
                                placeholder="e.g. thinly sliced, toasted, soaked"
                                className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <label className="flex items-center gap-2 self-end rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm">
                              <input type="checkbox" name="isOptional" defaultChecked={item.isOptional ?? false} />
                              Optional
                            </label>
                            {warning ? (
                              <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 ring-1 ring-amber-200 lg:col-span-3">
                                {warning}
                              </p>
                            ) : null}
                            <div className="flex justify-end lg:col-span-4">
                              <Button type="submit" variant="primary">
                                Save ingredient
                              </Button>
                            </div>
                          </form>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-slate-50 p-6 text-sm text-[var(--color-muted)]">
              No ingredients have been added yet. Use the builder below to add the first approved ingredient.
            </div>
          )}

          <form action={addIngredientsAction} className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">Add approved ingredients</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Every row must choose an ingredient and unit from the platform database.</p>
              </div>
              <Button type="button" variant="secondary" onClick={addRow}>
                Add row
              </Button>
            </div>

            <div className="space-y-4">
              {rows.map((rowId, index) => (
                <div key={rowId} className="rounded-3xl border border-emerald-100 bg-white p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,0.9fr)_minmax(0,0.8fr)]">
                    <IngredientSelect ingredients={ingredients} required={index === 0} />
                    <input
                      name="quantity"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required={index === 0}
                      placeholder="Qty"
                      className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                    />
                    <UnitSelect units={units} required={index === 0} />
                    <IngredientSectionSelect />
                    <input
                      name="preparationNote"
                      type="text"
                      placeholder="Preparation note"
                      className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm lg:col-span-3"
                    />
                    <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-[var(--color-ink)] ring-1 ring-[var(--color-border)]">
                      <input type="checkbox" name={`isOptional:${index}`} />
                      Optional
                    </label>
                  </div>
                  {rows.length > 1 ? (
                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="ghost" onClick={() => setRows((current) => current.filter((id) => id !== rowId))}>
                        Remove row
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <Button type="submit">Add selected ingredients</Button>
          </form>

          <form action={requestIngredientAction} className="space-y-3 rounded-3xl border border-dashed border-[var(--color-border)] bg-slate-50 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">Can&apos;t find this ingredient?</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                Request a canonical ingredient first. Pending requests are reviewed before they can be used for grocery merging.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="requestedName"
                required
                placeholder="Ingredient name"
                className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
              <select
                name="suggestedCategory"
                className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Suggested category</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea
                name="notes"
                rows={2}
                placeholder="Optional note for the platform team"
                className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm md:col-span-2"
              />
            </div>
            <Button type="submit" variant="secondary">
              Request ingredient
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
