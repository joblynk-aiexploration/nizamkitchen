import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMealPlanner, getMealPlanPreference } from "@/server/meal-plans";
import { createMealPlanAction, createMealPlanFromTemplateAction, createReadyMadeMealPlanAction } from "../actions";
import { canAccessFamilyProfiles, getHouseholdProfile } from "@/server/household";
import { listRecipes } from "@/server/recipes";
import { listAvailableMenuTemplates } from "@/server/templates";

export const dynamic = "force-dynamic";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function NewMealPlanPage() {
  const session = await requireMembership();
  const organizationId = session.activeOrganization.id;
  const enabled = await canAccessMealPlanner({
    organizationId,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Meal Planner"
          title="Meal planner is not enabled"
          description="Ask a platform admin to enable the meal planner feature flag for this organization."
        />
      </div>
    );
  }

  const [preference, familyProfilesEnabled] = await Promise.all([
    getMealPlanPreference(organizationId),
    canAccessFamilyProfiles({ organizationId, platformRole: session.user.platformRole }),
  ]);
  const householdProfile =
    familyProfilesEnabled && session.activeOrganization.organizationType === "household"
      ? await getHouseholdProfile(organizationId)
      : null;
  const templates = await listAvailableMenuTemplates({
    usage: "household",
    countryCode: session.activeOrganization.countryCode,
  });
  const recipeOptions = await listRecipes({
    organizationId,
    countryCode: session.activeOrganization.countryCode,
    publishedOnly: true,
  });
  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDate = addDays(startDate, 6);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title="Create a meal plan"
        description="Start with a date range and household size, then add recipes and custom meals day by day."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start from template</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">City, state, and country meal plan templates</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">City templates are prioritized first, then state, country, and global defaults.</p>
            </div>
          </div>
          {templates.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">No active household templates are available yet.</p>
          ) : (
            <form action={createMealPlanFromTemplateAction} className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
              <select name="templateId" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.templateType}, {template.city || template.region || template.countryCode || "global"})
                  </option>
                ))}
              </select>
              <input name="startDate" type="date" required defaultValue={toDateInput(startDate)} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <input name="householdSize" type="number" min="1" max="100" required defaultValue={householdProfile?.defaultHouseholdSize ?? preference?.defaultHouseholdSize ?? 4} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <button type="submit" className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">Use template</button>
            </form>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ready-made meal plan</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Build a full week or month automatically</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Tell us the title, people count, restrictions, diet notes, preferred foods, and day-of-week choices. NizamKitchen will use your published recipe library to fill breakfast, lunch, and dinner for every day.
            </p>
          </div>
          <form action={createReadyMadeMealPlanAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-name">
                Meal plan title
              </label>
              <input
                id="ready-name"
                name="name"
                type="text"
                required
                defaultValue="Ready-made weekly family plan"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-startDate">
                Start date
              </label>
              <input
                id="ready-startDate"
                name="startDate"
                type="date"
                required
                defaultValue={toDateInput(startDate)}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-duration">
                Plan length
              </label>
              <select
                id="ready-duration"
                name="duration"
                defaultValue="week"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              >
                <option value="week">One week</option>
                <option value="month">One month</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-householdSize">
                How many people?
              </label>
              <input
                id="ready-householdSize"
                name="householdSize"
                type="number"
                min="1"
                max="100"
                required
                defaultValue={householdProfile?.defaultHouseholdSize ?? preference?.defaultHouseholdSize ?? 4}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-dietPreference">
                Diet preference
              </label>
              <select
                id="ready-dietPreference"
                name="dietPreference"
                defaultValue=""
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              >
                <option value="">No specific diet</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="halal">Halal</option>
                <option value="gluten free">Gluten free</option>
                <option value="low carb">Low carb</option>
                <option value="high protein">High protein</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-restrictions">
                Restrictions or allergies
              </label>
              <textarea
                id="ready-restrictions"
                name="restrictions"
                rows={4}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                placeholder="Example: peanuts, shellfish, egg, very spicy"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-preferredFoods">
                Preferred foods
              </label>
              <textarea
                id="ready-preferredFoods"
                name="preferredFoods"
                rows={4}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                placeholder="Example: biryani, dal, rice, chicken, Hyderabadi"
              />
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Day-of-week preferences
              </p>
              <div className="mt-2 grid gap-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3 md:grid-cols-[180px_minmax(0,1fr)]">
                    <label className="sr-only" htmlFor={`ready-weekdayPreferenceDay-${index}`}>
                      Preference day {index + 1}
                    </label>
                    <select
                      id={`ready-weekdayPreferenceDay-${index}`}
                      name="weekdayPreferenceDays"
                      defaultValue=""
                      className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    >
                      <option value="">Choose day</option>
                      <option value="sunday">Sunday</option>
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                    </select>
                    <label className="sr-only" htmlFor={`ready-weekdayPreferenceRecipe-${index}`}>
                      Food for preference {index + 1}
                    </label>
                    <select
                      id={`ready-weekdayPreferenceRecipe-${index}`}
                      name="weekdayPreferenceRecipeIds"
                      defaultValue=""
                      className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    >
                      <option value="">Choose food</option>
                      {recipeOptions.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.name} ({recipe.cuisine.name})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Pick a day and the main food for that day. The generator will place that choice as dinner on the matching weekday, then fill the rest of the calendar around it.
              </p>
            </div>
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-muted-bg)] p-5 md:col-span-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Festival, party, or occasion</p>
                <h3 className="mt-2 text-base font-semibold text-[var(--color-ink)]">Add one special day to the calendar</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  If your family has a holiday, party, or cultural celebration during the plan, add the date and foods you usually eat. We will prioritize matching recipes on that day when they are available.
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-occasionName">
                    Occasion name
                  </label>
                  <input
                    id="ready-occasionName"
                    name="occasionName"
                    type="text"
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    placeholder="Example: Eid dinner, birthday party, Diwali, Ramadan iftar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-occasionDate">
                    Occasion date
                  </label>
                  <input
                    id="ready-occasionDate"
                    name="occasionDate"
                    type="date"
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-occasionCulture">
                    Culture or cuisine
                  </label>
                  <input
                    id="ready-occasionCulture"
                    name="occasionCulture"
                    type="text"
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    placeholder="Example: Hyderabadi, Indian, Pakistani, Arab"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="ready-occasionFoods">
                    Occasion foods
                  </label>
                  <textarea
                    id="ready-occasionFoods"
                    name="occasionFoods"
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    placeholder="Example: haleem, biryani, sheer khurma, kebabs"
                  />
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">
                Create ready-made plan
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <form action={createMealPlanAction} className="space-y-8">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="name">
                  Plan name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue="Weekly family plan"
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="startDate">
                  Start date
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={toDateInput(startDate)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="endDate">
                  End date
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  defaultValue={toDateInput(endDate)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="householdSize">
                  Household size
                </label>
                <input
                  id="householdSize"
                  name="householdSize"
                  type="number"
                  min="1"
                  max="100"
                  required
                  defaultValue={householdProfile?.defaultHouseholdSize ?? preference?.defaultHouseholdSize ?? 4}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="notes">
                  Planning notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  defaultValue={householdProfile?.notes ?? preference?.dietaryNotes ?? ""}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder="Weeknight shortcuts, dietary notes, or prep reminders..."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white"
              >
                Create meal plan
              </button>
              <Link
                href="/meal-plans"
                className="rounded-2xl border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">What happens next</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{"Plan -> Grocery List -> Cook"}</h2>
          </div>

          <div className="space-y-4 text-sm leading-6 text-[var(--color-muted)]">
            <p>1. Create the date range and household size.</p>
            <p>2. Add recipe-backed meals and any custom placeholders for takeout, leftovers, or prep days.</p>
            <p>3. Generate a grocery list that reuses the existing grocery engine and ignores custom meals automatically.</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            Your saved household profile and meal preferences prefill household size and planning notes here.
          </div>

          <Link href={householdProfile ? "/household/preferences" : "/settings/meal-preferences"} className="text-sm font-semibold text-[var(--color-primary)]">
            {householdProfile ? "Open household preferences" : "Open meal preferences"}
          </Link>
        </Card>
      </div>
    </div>
  );
}
