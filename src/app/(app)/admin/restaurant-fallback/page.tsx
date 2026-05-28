import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { getRestaurantFallbackMetrics } from "@/server/restaurants/restaurant-fallback-service";

export const dynamic = "force-dynamic";

const statusTone = {
  pending: "neutral",
  completed: "success",
  failed: "warning",
} as const;

export default async function AdminRestaurantFallbackPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);

  const metrics = await getRestaurantFallbackMetrics();

  const successRate =
    metrics.totalSearches > 0
      ? Math.round(((metrics.totalSearches - metrics.failedSearches) / metrics.totalSearches) * 100)
      : 100;

  return (
    <AdminShell
      session={session}
      title="Restaurant Fallback"
      description="Google Places-powered restaurant discovery usage and metrics."
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Total searches" value={metrics.totalSearches} hint="All time" />
          <MetricCard label="Failed searches" value={metrics.failedSearches} hint="Google Maps / Places errors" />
          <MetricCard label="Saved restaurants" value={metrics.savedCount} hint="Across all orgs" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Recent searches</h2>
            {metrics.recentSearches.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No searches yet.</p>
            ) : (
              <div className="space-y-2">
                {metrics.recentSearches.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-[var(--color-ink)]">{s.query}</span>
                    <Badge tone={statusTone[s.status as keyof typeof statusTone] ?? "neutral"}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Top queries</h2>
            {metrics.topQueries.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {metrics.topQueries.map((q) => (
                  <div key={q.query} className="flex items-center justify-between text-sm">
                    <span className="truncate text-[var(--color-ink)]">{q.query}</span>
                    <span className="text-[var(--color-muted)] shrink-0">{q.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {metrics.searchesByCountry.length > 0 && (
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Searches by country</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {metrics.searchesByCountry.map((r) => (
                <div key={r.countryCode} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-[var(--color-ink)]">{r.countryCode}</span>
                  <span className="text-[var(--color-muted)]">{r.count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="text-xs text-[var(--color-muted)]">
          Success rate: {successRate}% · Results sourced from Google Places text search.
        </p>
      </div>
    </AdminShell>
  );
}
