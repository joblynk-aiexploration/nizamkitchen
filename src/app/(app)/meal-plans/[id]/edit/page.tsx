import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { MealPlanEntryDrawer } from "@/components/meal-plans/meal-plan-entry-drawer";
import { listRecipes } from "@/server/recipes";
import { canAccessMealPlanner, getMealPlan, getMealPlanPreference } from "@/server/meal-plans";
import {
  addMealPlanEntryAction,
  deleteMealPlanAction,
  deleteMealPlanEntryAction,
  moveMealPlanEntryAction,
  updateMealPlanAction,
  updateMealPlanEntryAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const statusTone = {
  draft: "neutral",
  active: "success",
  completed: "info",
  archived: "warning",
} as const;

const entryStatusValues = ["planned", "cooked", "skipped", "ordered_instead", "replaced"] as const;
const mealTypeValues = ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "prep"] as const;

export default async function EditMealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireMembership();
  const enabled = await canAccessMealPlanner({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    notFound();
  }

  const [plan, recipes, preference] = await Promise.all([
    getMealPlan(id, session.activeOrganization.id).catch(() => null),
    listRecipes({
      organizationId: session.activeOrganization.id,
      publishedOnly: true,
    }),
    getMealPlanPreference(session.activeOrganization.id),
  ]);

  if (!plan) {
    notFound();
  }

  const recipeOptions = recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    servingUnit: recipe.servingUnit,
    cuisineName: recipe.cuisine.name,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title={`Edit ${plan.name}`}
        description="Adjust the date range, refine servings, and keep each day lined up for clean grocery generation."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <Card>
            <form action={updateMealPlanAction} className="space-y-6">
              <input type="hidden" name="mealPlanId" value={plan.id} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Plan settings</p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Core details</h2>
                </div>
                <Badge tone={statusTone[plan.status]}>{plan.status}</Badge>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="name">
                    Plan name
                  </label>
                  <input
                    id="name"
                    name="name"
                    defaultValue={plan.name}
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
                    defaultValue={plan.startDate.toISOString().slice(0, 10)}
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
                    defaultValue={plan.endDate.toISOString().slice(0, 10)}
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
                    defaultValue={plan.householdSize}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={plan.status}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  >
                    {Object.keys(statusTone).map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="notes">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    defaultValue={plan.notes ?? ""}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <Button type="submit">Save meal plan</Button>
            </form>
          </Card>

          <div className="space-y-5">
            {plan.days.map((day) => (
              <Card key={day.id} className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Day card</p>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
                      {day.dayLabel ?? day.date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {day.date.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </p>
                  </div>

                  <MealPlanEntryDrawer
                    mealPlanId={plan.id}
                    mealPlanDayId={day.id}
                    dayLabel={day.dayLabel ?? "Meal day"}
                    dateLabel={day.date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                    recipes={recipeOptions}
                    action={addMealPlanEntryAction}
                  />
                </div>

                {day.entries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                    No meals scheduled yet. Add recipes or custom meals for this day.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {day.entries.map((entry, index) => (
                      <div key={entry.id} className="rounded-3xl border border-[var(--color-border)] bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meal slot #{index + 1}</p>
                            <p className="mt-1 font-semibold text-[var(--color-ink)]">
                              {entry.recipe?.name ?? entry.customMealName ?? "Custom meal"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                              {entry.recipe?.cuisine?.name ? `${entry.recipe.cuisine.name} · ` : ""}
                              {entry.recipe ? "Recipe linked" : "Custom meal"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <form action={moveMealPlanEntryAction}>
                              <input type="hidden" name="mealPlanId" value={plan.id} />
                              <input type="hidden" name="entryId" value={entry.id} />
                              <input type="hidden" name="direction" value="up" />
                              <Button variant="ghost" type="submit" disabled={index === 0}>Up</Button>
                            </form>
                            <form action={moveMealPlanEntryAction}>
                              <input type="hidden" name="mealPlanId" value={plan.id} />
                              <input type="hidden" name="entryId" value={entry.id} />
                              <input type="hidden" name="direction" value="down" />
                              <Button variant="ghost" type="submit" disabled={index === day.entries.length - 1}>Down</Button>
                            </form>
                          </div>
                        </div>

                        <form action={updateMealPlanEntryAction} className="mt-4 space-y-4">
                          <input type="hidden" name="mealPlanId" value={plan.id} />
                          <input type="hidden" name="entryId" value={entry.id} />
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="xl:col-span-2">
                              <label className="block text-sm font-semibold text-[var(--color-ink)]">
                                Custom meal name
                              </label>
                              <input
                                name="customMealName"
                                defaultValue={entry.customMealName ?? ""}
                                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                                placeholder="Optional if a recipe is linked"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-[var(--color-ink)]">
                                Meal type
                              </label>
                              <select
                                name="mealType"
                                defaultValue={entry.mealType}
                                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                              >
                                {mealTypeValues.map((mealType) => (
                                  <option key={mealType} value={mealType}>
                                    {mealType.replace(/_/g, " ")}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-[var(--color-ink)]">
                                Servings
                              </label>
                              <input
                                name="targetServings"
                                type="number"
                                min="1"
                                max="100"
                                defaultValue={entry.targetServings}
                                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-[var(--color-ink)]">
                                Status
                              </label>
                              <select
                                name="status"
                                defaultValue={entry.status}
                                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                              >
                                {entryStatusValues.map((status) => (
                                  <option key={status} value={status}>
                                    {status.replace(/_/g, " ")}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2 xl:col-span-3">
                              <label className="block text-sm font-semibold text-[var(--color-ink)]">
                                Notes
                              </label>
                              <input
                                name="notes"
                                defaultValue={entry.notes ?? ""}
                                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                                placeholder="Cooked ahead, swap sides, freezer prep..."
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <Button type="submit">Save meal</Button>
                          </div>
                        </form>

                        <form action={deleteMealPlanEntryAction} className="mt-3">
                          <input type="hidden" name="mealPlanId" value={plan.id} />
                          <input type="hidden" name="entryId" value={entry.id} />
                          <Button variant="danger" type="submit">Delete</Button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preference carry-over</p>
            <div className="space-y-3 text-sm text-[var(--color-muted)]">
              <p>Default household size: <span className="font-semibold text-[var(--color-ink)]">{preference?.defaultHouseholdSize ?? "Not set"}</span></p>
              <p>Spice preference: <span className="font-semibold text-[var(--color-ink)]">{preference?.spicePreference ?? "Not set"}</span></p>
              <p>Cooking days: <span className="font-semibold text-[var(--color-ink)]">{preference?.weeklyCookingDays.join(", ") || "Not set"}</span></p>
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Editing tips</p>
            <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
              <p>Recipe-backed entries feed the grocery engine directly.</p>
              <p>Custom meals stay on the plan but are skipped during grocery generation.</p>
              <p>Reorder within a day to keep breakfast, lunch, dinner, and prep flows intentional.</p>
            </div>
          </Card>

          <Card className="space-y-4 border-rose-200 bg-rose-50/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Danger zone</p>
            <p className="text-sm leading-6 text-rose-900/80">
              Deleting a meal plan removes its day cards and meal entries. Generated grocery lists are preserved, but they will no longer point back to this plan.
            </p>
            <form action={deleteMealPlanAction}>
              <input type="hidden" name="mealPlanId" value={plan.id} />
              <Button type="submit" variant="danger">Delete meal plan</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
