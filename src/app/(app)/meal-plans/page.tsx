import Link from "next/link";
import { CalendarDays, ChefHat, ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMealPlanner, listMealPlans, toMealPlanDateRange } from "@/server/meal-plans";

export const dynamic = "force-dynamic";

const statusTone = {
  draft: "neutral",
  active: "success",
  completed: "info",
  archived: "warning",
} as const;

export default async function MealPlansPage() {
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
          title="Plan -> Grocery List -> Cook"
          description="Build meal plans, adjust servings, and turn the week into a grocery list when the feature is enabled for your organization."
        />
        <Card>
          <div className="space-y-4 py-14 text-center">
            <p className="text-xl font-semibold text-[var(--color-ink)]">Meal planner is almost ready</p>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
              Your organization is not enabled for meal planning yet. Once the flag is turned on, you will be able to schedule recipes across days, track what got cooked, and generate grocery lists straight from the plan.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const plans = await listMealPlans(organizationId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title="Meal Plans"
        description="Map out the week, adjust servings by household size, and reuse your recipe foundation without rebuilding grocery logic."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
            <CalendarDays className="h-4 w-4" />
            Weekly calendar
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
            <ChefHat className="h-4 w-4" />
            Recipe-powered meals
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
            <ShoppingBasket className="h-4 w-4" />
            Grocery handoff
          </span>
        </div>
        <Button asChild>
          <Link href="/meal-plans/new">Create meal plan</Link>
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="No meal plans yet"
          description="Create your first plan to arrange recipes by day, track what gets cooked, and generate a grocery list from the finished schedule."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {plans.map((plan) => {
            const totalMeals = plan.days.reduce((sum, day) => sum + day._count.entries, 0);
            return (
              <Card key={plan.id} className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/meal-plans/${plan.id}`} className="text-lg font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">
                      {plan.name}
                    </Link>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">{toMealPlanDateRange(plan)}</p>
                  </div>
                  <Badge tone={statusTone[plan.status]}>{plan.status}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Days</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{plan._count.days}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Meal slots</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{totalMeals}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Linked lists</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{plan._count.groceryLists}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Calendar snapshot</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {plan.days.slice(0, 6).map((day) => (
                      <div key={day.date.toISOString()} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--color-ink)]">
                          {day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {day._count.entries} planned meal{day._count.entries === 1 ? "" : "s"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="secondary">
                    <Link href={`/meal-plans/${plan.id}`}>Open plan</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={`/meal-plans/${plan.id}/edit`}>Edit plan</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={`/meal-plans/${plan.id}/grocery-list`}>Grocery handoff</Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
