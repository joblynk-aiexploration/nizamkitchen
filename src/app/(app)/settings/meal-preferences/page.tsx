import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canAccessMealPlanner, getMealPlanPreference } from "@/server/meal-plans";
import { updateMealPlanPreferencesAction } from "../../meal-plans/actions";

export const dynamic = "force-dynamic";

const cookingDays = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

export default async function MealPreferencesPage() {
  const session = await requireMembership();
  const enabled = await canAccessMealPlanner({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Meal Planner"
          title="Meal preferences are not enabled"
          description="Enable the meal planner feature flag to start saving household planning defaults."
        />
      </div>
    );
  }

  const [preference, countries, cuisines] = await Promise.all([
    getMealPlanPreference(session.activeOrganization.id),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { countryName: "asc" } }),
    prisma.cuisine.findMany({ orderBy: { name: "asc" }, take: 40 }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title="Meal preferences"
        description="Save the planning defaults your household uses most often so each new meal plan starts closer to real life."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <Card>
          <form action={updateMealPlanPreferencesAction} className="space-y-8">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="defaultHouseholdSize">
                  Default household size
                </label>
                <input
                  id="defaultHouseholdSize"
                  name="defaultHouseholdSize"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={preference?.defaultHouseholdSize ?? ""}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="defaultCountryCode">
                  Default country
                </label>
                <select
                  id="defaultCountryCode"
                  name="defaultCountryCode"
                  defaultValue={preference?.defaultCountryCode ?? session.activeOrganization.countryCode}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                >
                  <option value="">No override</option>
                  {countries.map((country) => (
                    <option key={country.countryCode} value={country.countryCode}>
                      {country.countryName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="spicePreference">
                  Preferred spice level
                </label>
                <select
                  id="spicePreference"
                  name="spicePreference"
                  defaultValue={preference?.spicePreference ?? ""}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                >
                  <option value="">No preference</option>
                  <option value="mild">Mild</option>
                  <option value="medium">Medium</option>
                  <option value="hot">Hot</option>
                  <option value="extra_hot">Extra hot</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="measurementSystem">
                  Measurement preference
                </label>
                <select
                  id="measurementSystem"
                  name="measurementSystem"
                  defaultValue={preference?.measurementSystem ?? session.activeOrganization.measurementSystem}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                >
                  <option value="">Use organization default</option>
                  <option value="metric">Metric</option>
                  <option value="imperial">Imperial</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="preferredCuisines">
                  Preferred cuisines
                </label>
                <textarea
                  id="preferredCuisines"
                  name="preferredCuisines"
                  rows={3}
                  defaultValue={preference?.preferredCuisines.join(", ") ?? ""}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder={`Examples: ${cuisines.slice(0, 6).map((cuisine) => cuisine.name).join(", ")}`}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="avoidedIngredients">
                  Avoided ingredients
                </label>
                <textarea
                  id="avoidedIngredients"
                  name="avoidedIngredients"
                  rows={3}
                  defaultValue={preference?.avoidedIngredients.join(", ") ?? ""}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder="Examples: peanuts, shellfish, beef"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="dietaryNotes">
                  Dietary notes
                </label>
                <textarea
                  id="dietaryNotes"
                  name="dietaryNotes"
                  rows={4}
                  defaultValue={preference?.dietaryNotes ?? ""}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder="Ramadan planning, school lunch constraints, preferred prep rhythm..."
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--color-ink)]">Default cooking days</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {cookingDays.map((day) => (
                  <label key={day.value} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      name="weeklyCookingDays"
                      value={day.value}
                      defaultChecked={preference?.weeklyCookingDays.includes(day.value) ?? false}
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white"
            >
              Save preferences
            </button>
          </form>
        </Card>

        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">How this helps</p>
          <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
            <p>Prefill household size and dietary constraints when a new meal plan starts.</p>
            <p>Keep cuisine preferences visible when you are choosing recipes for the week.</p>
            <p>Make sure grocery generation reflects the measurement system your household actually shops with.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
