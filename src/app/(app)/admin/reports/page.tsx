import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminReportData } from "@/server/reports/admin-reports";

export const dynamic = "force-dynamic";

const exportBase = "/api/admin/reports/export";

function ExportLink({ type, label }: { type: string; label: string }) {
  return (
    <Link
      href={`${exportBase}?type=${type}`}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] hover:bg-slate-50"
    >
      ↓ {label}
    </Link>
  );
}

export default async function AdminReportsPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);

  const data = await getAdminReportData(session);

  const canExport =
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin" ||
    session.user.platformRole === "country_manager" ||
    session.user.platformRole === "support_admin";

  return (
    <AdminShell
      session={session}
      title={data.isCountryManager ? "Country reports" : "Platform reports"}
      description={
        data.isCountryManager
          ? `Analytics scoped to: ${data.assignedCountries.join(", ")}`
          : "Platform-wide analytics across all organizations, modules, and countries."
      }
    >
      {/* ── Top metrics ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Total organizations"
          value={data.totalOrganizations}
          hint="All org types in scope."
        />
        <AdminMetricCard
          label="Households"
          value={data.householdCount}
          hint="Active household organizations."
        />
        <AdminMetricCard
          label="Chef businesses"
          value={data.chefBusinessCount}
          hint="Chef marketplace participants."
        />
        <AdminMetricCard
          label="Restaurant partners"
          value={data.restaurantPartnerCount}
          hint="Restaurant partner organizations."
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Recipes"
          value={data.totalRecipes}
          hint={`${data.publishedRecipes} published.`}
        />
        <AdminMetricCard
          label="Meal plans"
          value={data.totalMealPlans}
          hint="Total across all organizations."
        />
        <AdminMetricCard
          label="Grocery lists"
          value={data.totalGroceryLists}
          hint="Total generated."
        />
        <AdminMetricCard
          label="Video coverage"
          value={`${data.videoCoveragePct}%`}
          hint={`${data.recipesWithVideo} of ${data.publishedRecipes} published recipes have a YouTube video.`}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ── Home chef requests by status ── */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[var(--color-ink)]">
              Home chef requests
              <span className="ml-1.5 text-sm font-normal text-[var(--color-muted)]">
                ({data.homeChefTotal})
              </span>
            </h2>
            {canExport && <ExportLink type="home_chef_requests" label="CSV" />}
          </div>
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
            {data.homeChefRequestsByStatus.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">No requests yet.</p>
            )}
          </div>
        </Card>

        {/* ── Chef marketplace ── */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[var(--color-ink)]">
              Chef marketplace
            </h2>
            {canExport && <ExportLink type="chef_profiles" label="CSV" />}
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Total profiles</span>
              <span className="font-semibold text-[var(--color-ink)]">{data.chefProfilesTotal}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Active chefs</span>
              <Badge tone="success">{data.chefProfilesActive}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Saved restaurants</span>
              <span className="font-semibold text-[var(--color-ink)]">{data.savedRestaurantsCount}</span>
            </div>
          </div>
        </Card>

        {/* ── Restaurant fallback ── */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[var(--color-ink)]">
              Restaurant searches
              <span className="ml-1.5 text-sm font-normal text-[var(--color-muted)]">
                ({data.restaurantSearchTotal})
              </span>
            </h2>
            {canExport && <ExportLink type="restaurant_searches" label="CSV" />}
          </div>
          <div className="mt-4 space-y-2">
            {data.restaurantSearchesByStatus.map((r) => (
              <div key={r.status} className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm odd:bg-slate-50">
                <span className="capitalize text-[var(--color-ink)]">{r.status}</span>
                <Badge
                  tone={r.status === "completed" ? "success" : r.status === "failed" ? "danger" : "neutral"}
                >
                  {r.count}
                </Badge>
              </div>
            ))}
            {data.restaurantSearchesByStatus.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">No searches yet.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Organizations by country ── */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[var(--color-ink)]">Country breakdown</h2>
            {canExport && <ExportLink type="organizations" label="Export orgs CSV" />}
          </div>
          <div className="mt-4 space-y-2">
            {data.orgsByCountry.map((c) => (
              <div key={c.countryCode} className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm odd:bg-slate-50">
                <span className="font-medium text-[var(--color-ink)]">{c.countryCode}</span>
                <Badge tone="neutral">{c.count} orgs</Badge>
              </div>
            ))}
            {data.orgsByCountry.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">No organizations.</p>
            )}
          </div>
        </Card>

        {/* ── Feature flag adoption ── */}
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Feature flag adoption</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Total flags</span>
              <span className="font-semibold text-[var(--color-ink)]">{data.totalFlagsCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Enabled</span>
              <Badge tone="success">{data.enabledFlagsCount}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Disabled</span>
              <Badge tone="neutral">{data.totalFlagsCount - data.enabledFlagsCount}</Badge>
            </div>
            {data.totalFlagsCount > 0 && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((data.enabledFlagsCount / data.totalFlagsCount) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Recent organizations ── */}
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Recently created organizations</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {data.recentOrgs.map((org) => (
            <div key={org.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-[var(--color-ink)]">{org.name}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {org.organizationType.replace(/_/g, " ")} · {org.countryCode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={org.status === "active" ? "success" : "neutral"}>
                  {org.status}
                </Badge>
                <span className="text-xs text-[var(--color-muted)]">
                  {org.createdAt.toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {data.recentOrgs.length === 0 && (
            <p className="py-4 text-sm text-[var(--color-muted)]">No organizations yet.</p>
          )}
        </div>
      </Card>

      {/* ── Grocery export ── */}
      {canExport && (
        <div className="flex flex-wrap gap-3">
          <ExportLink type="grocery_usage" label="Grocery usage CSV" />
        </div>
      )}
    </AdminShell>
  );
}
