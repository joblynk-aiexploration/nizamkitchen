import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminMealPlannerData } from "@/server/admin/meal-planner";

export const dynamic = "force-dynamic";

export default async function AdminMealPlannerPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const data = await getAdminMealPlannerData(session);

  return (
    <AdminShell
      session={session}
      title="Meal Planner"
      description="Track adoption of weekly planning and how often those plans are turning into grocery execution."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Total meal plans</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-ink)]">{data.totalMealPlans}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Active meal plans</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-ink)]">{data.activeMealPlans}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Meal-plan grocery lists</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-ink)]">{data.groceryListsGenerated}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Meal plans by country</h2>
          <div className="mt-4 space-y-3">
            {data.mealPlansByCountry.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No meal plans created yet.</p>
            ) : (
              data.mealPlansByCountry.map((row) => (
                <div key={row.countryCode} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-[var(--color-ink)]">{row.countryCode}</span>
                  <span className="text-sm text-[var(--color-muted)]">{row.count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Most planned recipes</h2>
          <div className="mt-4 space-y-3">
            {data.mostPlannedRecipes.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No recipe-backed meals have been planned yet.</p>
            ) : (
              data.mostPlannedRecipes.map((row) => (
                <div key={`${row.recipeId ?? "custom"}-${row.recipeName}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-[var(--color-ink)]">{row.recipeName}</span>
                  <span className="text-sm text-[var(--color-muted)]">{row.count}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
