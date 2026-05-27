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
const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

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
  const dayByIso = new Map(plan.days.map((day) => [day.date.toISOString().slice(0, 10), day]));
  const calendarStart = addUtcDays(plan.startDate, -plan.startDate.getUTCDay());
  const calendarEndOffset = 6 - plan.endDate.getUTCDay();
  const calendarEnd = addUtcDays(plan.endDate, calendarEndOffset);
  const calendarCells = [];
  for (let day = new Date(calendarStart); day <= calendarEnd; day = addUtcDays(day, 1)) {
    const iso = day.toISOString().slice(0, 10);
    calendarCells.push({
      date: new Date(day),
      iso,
      planDay: dayByIso.get(iso),
      inPlanRange: day >= plan.startDate && day <= plan.endDate,
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title={`Edit ${plan.name}`}
        description="Adjust the date range, refine servings, and keep each day lined up for clean grocery generation."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
              Deleting a meal plan removes its calendar days and meal entries. Generated grocery lists are preserved, but they will no longer point back to this plan.
            </p>
            <form action={deleteMealPlanAction}>
              <input type="hidden" name="mealPlanId" value={plan.id} />
              <Button type="submit" variant="danger">Delete meal plan</Button>
            </form>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meal calendar</p>
            <h2 className="mt-2 font-serif text-3xl text-[var(--color-ink)]">{formatMonthTitle(plan.startDate)}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden rounded-2xl border border-[var(--color-border)] p-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 sm:flex">
              <span className="rounded-xl px-3 py-2">Daily</span>
              <span className="rounded-xl px-3 py-2">Weekly</span>
              <span className="rounded-xl bg-white px-3 py-2 text-blue-700 shadow-sm ring-1 ring-blue-100">Monthly</span>
            </div>
            <Badge tone="info">{plan.days.length} days</Badge>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-slate-50">
          {weekdayHeaders.map((weekday) => (
            <div key={weekday} className="border-r border-[var(--color-border)] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 last:border-r-0">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
          {calendarCells.map((cell) => {
            const day = cell.planDay;
            const isCurrentMonth = cell.date.getUTCMonth() === plan.startDate.getUTCMonth();

            return (
              <div
                key={cell.iso}
                className={[
                  "min-h-56 border-b border-r border-[var(--color-border)] bg-white p-3 last:border-r-0 lg:min-h-64",
                  !cell.inPlanRange ? "bg-slate-50/70 text-slate-400" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={["text-sm font-semibold", isCurrentMonth ? "text-[var(--color-ink)]" : "text-slate-400"].join(" ")}>
                      {cell.date.getUTCDate()}
                    </p>
                    <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:hidden">
                      {weekdayHeaders[cell.date.getUTCDay()]}
                    </p>
                  </div>
                  {day ? (
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
                  ) : null}
                </div>

                {day ? (
                  day.entries.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50 px-3 py-5 text-center text-sm text-[var(--color-muted)]">
                      No dishes yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {day.entries.map((entry, index) => (
                        <details key={entry.id} className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-teal-700">
                                  {entry.mealType.replace(/_/g, " ")}
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-[var(--color-ink)]">
                                  {entry.recipe?.name ?? entry.customMealName ?? "Custom meal"}
                                </p>
                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                  {entry.targetServings} serving{entry.targetServings === 1 ? "" : "s"}
                                  {entry.recipe?.cuisine?.name ? ` · ${entry.recipe.cuisine.name}` : ""}
                                </p>
                              </div>
                              <span className="rounded-full bg-white px-2 py-1 text-[0.65rem] font-semibold capitalize text-slate-600 ring-1 ring-slate-200">
                                {entry.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            {entry.notes ? (
                              <p className="mt-2 line-clamp-2 text-xs text-[var(--color-muted)]">{entry.notes}</p>
                            ) : null}
                            <p className="mt-2 text-xs font-semibold text-[var(--color-primary)]">Edit meal</p>
                          </summary>

                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <div className="flex flex-wrap gap-2">
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

                            <form action={updateMealPlanEntryAction} className="mt-3 space-y-3">
                              <input type="hidden" name="mealPlanId" value={plan.id} />
                              <input type="hidden" name="entryId" value={entry.id} />
                              <label className="block text-xs font-semibold text-[var(--color-ink)]">
                                Custom meal name
                                <input name="customMealName" defaultValue={entry.customMealName ?? ""} className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Optional if a recipe is linked" />
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-xs font-semibold text-[var(--color-ink)]">
                                  Meal type
                                  <select name="mealType" defaultValue={entry.mealType} className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                                    {mealTypeValues.map((mealType) => (
                                      <option key={mealType} value={mealType}>{mealType.replace(/_/g, " ")}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-xs font-semibold text-[var(--color-ink)]">
                                  Servings
                                  <input name="targetServings" type="number" min="1" max="100" defaultValue={entry.targetServings} className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
                                </label>
                                <label className="block text-xs font-semibold text-[var(--color-ink)] sm:col-span-2">
                                  Status
                                  <select name="status" defaultValue={entry.status} className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                                    {entryStatusValues.map((status) => (
                                      <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <label className="block text-xs font-semibold text-[var(--color-ink)]">
                                Notes
                                <input name="notes" defaultValue={entry.notes ?? ""} className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Cooked ahead, swap sides, freezer prep..." />
                              </label>
                              <Button type="submit" className="w-full justify-center">Save meal</Button>
                            </form>

                            <form action={deleteMealPlanEntryAction} className="mt-3">
                              <input type="hidden" name="mealPlanId" value={plan.id} />
                              <input type="hidden" name="entryId" value={entry.id} />
                              <Button variant="danger" type="submit" className="w-full justify-center">Delete</Button>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="mt-4 h-24 rounded-2xl border border-dashed border-slate-200 bg-white/50" />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
