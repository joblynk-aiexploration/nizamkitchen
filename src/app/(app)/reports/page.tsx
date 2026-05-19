import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { getHouseholdReportData } from "@/server/reports/household-reports";

export const dynamic = "force-dynamic";

const severityTone = {
  preference: "neutral",
  avoid: "warning",
  strict: "danger",
} as const;

export default async function HouseholdReportsPage() {
  const session = await requireMembership();
  const data = await getHouseholdReportData(session);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Insights"
        title="Household reports"
        description="Your cooking activity, grocery usage, and marketplace engagement at a glance."
      />

      {/* ── Top metrics ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Meals planned (7 days)"
          value={data.mealsPlannedThisWeek}
          hint="Meal entries in any plan for the last 7 days."
        />
        <MetricCard
          label="Grocery lists (this month)"
          value={data.groceryListsThisMonth}
          hint={`${data.allGroceryListsCount} total all-time.`}
        />
        <MetricCard
          label="Saved restaurants"
          value={data.savedRestaurantsCount}
          hint="Places you've bookmarked for ordering instead."
        />
        <MetricCard
          label="Restaurant searches"
          value={data.restaurantSearchesCount}
          hint={`${data.restaurantSearchesThisMonth} this month.`}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Most cooked recipes ── */}
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Most cooked recipes</h2>
          {data.mostCookedRecipes.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              No cooked meals recorded yet. Mark meal plan entries as cooked to see this.
            </p>
          ) : (
            <ol className="mt-4 space-y-2">
              {data.mostCookedRecipes.map((r, i) => (
                <li key={r.recipeId} className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm odd:bg-slate-50">
                  <span className="flex items-center gap-3">
                    <span className="w-5 font-mono text-xs font-bold text-slate-400">{i + 1}</span>
                    <span className="font-medium text-[var(--color-ink)]">{r.recipeName}</span>
                  </span>
                  <Badge tone="success">×{r.count}</Badge>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* ── Favorite recipes ── */}
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Favorite recipes</h2>
          {data.favoriteRecipes.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              No favorites yet. Heart a recipe to save it here.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {data.favoriteRecipes.map((f) => (
                <li key={f.recipeId} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm odd:bg-slate-50">
                  <span className="text-pink-500">♥</span>
                  <span className="font-medium text-[var(--color-ink)]">{f.recipeName}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Grocery items by category ── */}
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Grocery items by category</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">From grocery lists generated this month.</p>
          {data.groceryItemsByCategory.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">No grocery lists generated this month.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {data.groceryItemsByCategory.map((g) => (
                <div key={g.category} className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm odd:bg-slate-50">
                  <span className="capitalize text-[var(--color-ink)]">{g.category}</span>
                  <Badge tone="neutral">{g.count} items</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Home chef requests ── */}
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">
            Home chef requests
            <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">
              ({data.homeChefRequestsTotal} total)
            </span>
          </h2>
          {data.homeChefRequestsByStatus.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">No home chef requests yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {data.homeChefRequestsByStatus.map((r) => (
                <div key={r.status} className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm odd:bg-slate-50">
                  <span className="capitalize text-[var(--color-ink)]">{r.status.replace(/_/g, " ")}</span>
                  <Badge
                    tone={
                      r.status === "completed" ? "success"
                      : r.status === "cancelled" || r.status === "declined" ? "danger"
                      : r.status === "matched" || r.status === "accepted" ? "info"
                      : "neutral"
                    }
                  >
                    {r.count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Avoided ingredients ── */}
      {data.avoidedIngredients.length > 0 && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">
            Avoided ingredients
            <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">
              ({data.avoidedIngredients.length})
            </span>
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            These are filtered from recipe suggestions and grocery list warnings.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.avoidedIngredients.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] px-3 py-1.5">
                <span className="text-sm text-[var(--color-ink)]">{a.ingredientName}</span>
                <Badge tone={severityTone[a.severity] ?? "neutral"}>{a.severity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
