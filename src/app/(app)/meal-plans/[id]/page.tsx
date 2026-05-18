import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMealPlanner, getMealPlan, toMealPlanDateRange } from "@/server/meal-plans";
import { canAccessHomeChefs, isHouseholdRequestOrganization } from "@/server/home-chef";
import { duplicateMealPlanAction, generateMealPlanGroceryListAction } from "../actions";

export const dynamic = "force-dynamic";

const statusTone = {
  draft: "neutral",
  active: "success",
  completed: "info",
  archived: "warning",
} as const;

const entryStatusTone = {
  planned: "neutral",
  cooked: "success",
  skipped: "warning",
  ordered_instead: "info",
  replaced: "danger",
} as const;

export default async function MealPlanDetailPage({
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

  const plan = await getMealPlan(id, session.activeOrganization.id).catch(() => null);
  if (!plan) {
    notFound();
  }
  const homeChefsEnabled = await canAccessHomeChefs({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  const showHomeChefRequest =
    homeChefsEnabled && isHouseholdRequestOrganization(session.activeOrganization.organizationType);

  const totalMeals = plan.days.reduce((sum, day) => sum + day.entries.length, 0);
  const recipeMeals = plan.days.reduce(
    (sum, day) => sum + day.entries.filter((entry) => entry.recipeId).length,
    0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title={plan.name}
        description={`${toMealPlanDateRange(plan)} · ${plan.householdSize} people · created by ${plan.createdBy.fullName}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Badge tone={statusTone[plan.status]}>{plan.status}</Badge>
          <Badge tone="info">{totalMeals} meals planned</Badge>
          <Badge tone="neutral">{recipeMeals} recipe-backed</Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={`/meal-plans/${plan.id}/edit`}>Edit plan</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/meal-plans/${plan.id}/grocery-list`}>Grocery handoff</Link>
          </Button>
          {showHomeChefRequest ? (
            <Button asChild variant="secondary">
              <Link href={`/home-chef/request?type=meal_plan&mealPlanId=${plan.id}`}>
                Request a chef for this meal plan
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="space-y-6">
          <Card className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Weekly calendar</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Calendar view</h2>
              </div>
              <p className="text-sm text-[var(--color-muted)]">{plan.days.length} day range</p>
            </div>

            {plan.days.length === 0 ? (
              <EmptyState title="No calendar days" description="This meal plan does not have any scheduled days yet." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {plan.days.map((day) => (
                  <div key={day.id} className="rounded-3xl border border-[var(--color-border)] bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-ink)]">{day.dayLabel ?? day.date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {day.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                        </p>
                      </div>
                      <Badge tone="neutral">{day.entries.length}</Badge>
                    </div>

                    {day.entries.length === 0 ? (
                      <p className="mt-5 text-sm text-[var(--color-muted)]">No meals added for this day yet.</p>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {day.entries.map((entry) => (
                          <div key={entry.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{entry.mealType.replace(/_/g, " ")}</p>
                                <p className="mt-1 font-semibold text-[var(--color-ink)]">
                                  {entry.recipe?.name ?? entry.customMealName ?? "Custom meal"}
                                </p>
                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                  {entry.targetServings} serving{entry.targetServings === 1 ? "" : "s"}
                                  {entry.recipe?.cuisine?.name ? ` · ${entry.recipe.cuisine.name}` : ""}
                                </p>
                              </div>
                              <Badge tone={entryStatusTone[entry.status]}>{entry.status}</Badge>
                            </div>
                            {entry.notes ? (
                              <p className="mt-3 text-sm text-[var(--color-muted)]">{entry.notes}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">List view</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Chronological meal list</h2>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)]">
              <div className="grid grid-cols-[140px_120px_minmax(0,1fr)_100px_120px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Date</span>
                <span>Meal slot</span>
                <span>Meal</span>
                <span>Servings</span>
                <span>Status</span>
              </div>
              {plan.days.flatMap((day) =>
                day.entries.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[140px_120px_minmax(0,1fr)_100px_120px] border-t border-[var(--color-border)] px-4 py-3 text-sm">
                    <span className="text-[var(--color-muted)]">
                      {day.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    <span className="text-[var(--color-muted)]">{entry.mealType.replace(/_/g, " ")}</span>
                    <span className="font-medium text-[var(--color-ink)]">
                      {entry.recipe?.name ?? entry.customMealName ?? "Custom meal"}
                    </span>
                    <span className="text-[var(--color-muted)]">{entry.targetServings}</span>
                    <span><Badge tone={entryStatusTone[entry.status]}>{entry.status}</Badge></span>
                  </div>
                )),
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Plan summary</p>
            <div className="grid gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Household size</p>
                <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{plan.householdSize}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Linked grocery lists</p>
                <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{plan.groceryLists.length}</p>
              </div>
              {plan.notes ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notes</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{plan.notes}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</p>

            <form action={generateMealPlanGroceryListAction}>
              <input type="hidden" name="mealPlanId" value={plan.id} />
              <Button className="w-full justify-center">Generate grocery list</Button>
            </form>

            <form action={duplicateMealPlanAction} className="space-y-3">
              <input type="hidden" name="mealPlanId" value={plan.id} />
              <input
                type="text"
                name="name"
                placeholder={`${plan.name} Copy`}
                className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
              <input
                type="date"
                name="startDate"
                className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
              <Button variant="secondary" className="w-full justify-center">Duplicate plan</Button>
            </form>
          </Card>

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Grocery history</p>
            {plan.groceryLists.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No grocery lists have been generated from this plan yet.</p>
            ) : (
              <div className="space-y-3">
                {plan.groceryLists.map((list) => (
                  <Link key={list.id} href={`/grocery-lists/${list.id}`} className="block rounded-2xl border border-[var(--color-border)] px-4 py-3 transition hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--color-ink)]">{list.name}</p>
                      <Badge tone={statusTone[list.status]}>{list.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-[var(--color-muted)]">
                      {list._count.items} items · {list._count.warnings} warnings · {list.createdAt.toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
