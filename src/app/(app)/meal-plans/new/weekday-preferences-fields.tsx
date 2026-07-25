"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type RecipeOption = {
  id: string;
  name: string;
  cuisine: { name: string };
  sourceRecipeId?: string | null;
  isUserCustomized?: boolean;
};

const weekdays = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
];

function SelectWrap({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

export function WeekdayPreferencesFields({
  recipeOptions,
  sectionLabel = "Day-of-week preferences",
  dayFieldName = "weekdayPreferenceDays",
  recipeFieldName = "weekdayPreferenceRecipeIds",
  emptyDayLabel = "Choose day",
  emptyRecipeLabel = "Choose food",
}: {
  recipeOptions: RecipeOption[];
  sectionLabel?: string;
  dayFieldName?: string;
  recipeFieldName?: string;
  emptyDayLabel?: string;
  emptyRecipeLabel?: string;
}) {
  const [rows, setRows] = useState([0, 1, 2]);

  function addRow() {
    setRows((current) => [...current, Date.now()]);
  }

  function removeRow(row: number) {
    setRows((current) => current.filter((item) => item !== row));
  }

  return (
    <div className="md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--color-ink)]">{sectionLabel}</p>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)] transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Plus className="h-4 w-4" />
          Add preference
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {rows.map((row, index) => (
          <div key={row} className="grid gap-3 rounded-2xl bg-slate-50/80 p-3 md:grid-cols-[180px_minmax(0,1fr)_44px]">
            <label className="sr-only" htmlFor={`ready-weekdayPreferenceDay-${row}`}>
              Preference day {index + 1}
            </label>
            <SelectWrap>
              <select
                id={`ready-weekdayPreferenceDay-${row}`}
                name={dayFieldName}
                defaultValue=""
                className="w-full appearance-none rounded-2xl bg-white px-4 py-3 pr-10 text-sm text-[var(--color-ink)] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none transition focus:shadow-[inset_0_0_0_1px_var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25"
              >
                <option value="">{emptyDayLabel}</option>
                {weekdays.map((weekday) => (
                  <option key={weekday.value} value={weekday.value}>
                    {weekday.label}
                  </option>
                ))}
              </select>
            </SelectWrap>

            <label className="sr-only" htmlFor={`ready-weekdayPreferenceRecipe-${row}`}>
              Food for preference {index + 1}
            </label>
            <SelectWrap>
              <select
                id={`ready-weekdayPreferenceRecipe-${row}`}
                name={recipeFieldName}
                defaultValue=""
                className="w-full appearance-none rounded-2xl bg-white px-4 py-3 pr-10 text-sm text-[var(--color-ink)] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none transition focus:shadow-[inset_0_0_0_1px_var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25"
              >
                <option value="">{emptyRecipeLabel}</option>
                {recipeOptions.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name} ({recipe.cuisine.name}) · My Recipe
                    {recipe.sourceRecipeId || recipe.isUserCustomized ? " · Customized" : ""}
                  </option>
                ))}
              </select>
            </SelectWrap>

            <button
              type="button"
              onClick={() => removeRow(row)}
              disabled={rows.length === 1}
              aria-label={`Remove preference ${index + 1}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-[inset_0_0_0_1px_var(--color-border)] transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Pick a day and the main food for that day. The generator will place that choice as dinner on the matching weekday, then fill the rest of the calendar around it.
      </p>
    </div>
  );
}
