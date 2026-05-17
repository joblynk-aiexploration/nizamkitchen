import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMealPlanner, getMealPlan } from "@/server/meal-plans";
import { generateMealPlanGroceryListAction } from "../../actions";

export const dynamic = "force-dynamic";

const entryStatusTone = {
  planned: "neutral",
  cooked: "success",
  skipped: "warning",
  ordered_instead: "info",
  replaced: "danger",
} as const;

export default async function MealPlanGroceryListPage({
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

  const recipeEntries = plan.days.flatMap((day) =>
    day.entries.filter(
      (entry) => entry.recipeId && (entry.status === "planned" || entry.status === "cooked"),
    ),
  );
  const customEntries = plan.days.flatMap((day) => day.entries.filter((entry) => !entry.recipeId));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title="Grocery list handoff"
        description="Review which meals will feed the grocery engine and which custom placeholders will stay visible only on the plan."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Included in grocery generation</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{recipeEntries.length} recipe meals</h2>
            </div>
            <Badge tone="success">Engine ready</Badge>
          </div>

          <div className="space-y-3">
            {recipeEntries.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Add at least one recipe-backed meal before generating a grocery list.</p>
            ) : (
              recipeEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[var(--color-border)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">{entry.recipe?.name}</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {entry.mealType.replace(/_/g, " ")} · {entry.targetServings} servings
                      </p>
                    </div>
                    <Badge tone={entryStatusTone[entry.status]}>{entry.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Skipped intentionally</p>
            {customEntries.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">There are no custom-only meals in this plan.</p>
            ) : (
              <div className="space-y-3">
                {customEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-[var(--color-ink)]">{entry.customMealName ?? "Custom meal"}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {entry.mealType.replace(/_/g, " ")} · hidden from grocery generation
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Generate</p>
            <form action={generateMealPlanGroceryListAction} className="space-y-4">
              <input type="hidden" name="mealPlanId" value={plan.id} />
              <Button className="w-full justify-center" disabled={recipeEntries.length === 0}>
                Generate grocery list
              </Button>
            </form>
            <Link href={`/meal-plans/${plan.id}/edit`} className="block text-sm font-semibold text-[var(--color-primary)]">
              Edit meal plan first
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
