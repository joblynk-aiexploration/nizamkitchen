import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/server/admin/dashboard";
import { requirePlatformRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const data = await getAdminDashboardData(session);

  return (
    <AdminShell
      session={session}
      title="Platform admin control center"
      description="Operate users, organizations, countries, controls, and auditability from one enterprise-grade control plane."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href="/admin/audit-logs">Review audit logs</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/countries">Manage countries</Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Total users" value={data.totalUsers} hint="Scoped to your permitted admin footprint." />
        <AdminMetricCard label="Organizations" value={data.totalOrganizations} hint="Cross-tenant visibility with server-side isolation." />
        <AdminMetricCard label="Active countries" value={data.activeCountries} hint="Operational countries available to the platform." />
        <AdminMetricCard label="Denied access events" value={data.accessDeniedCount} hint="Recent security-sensitive blocked actions." />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">Recent audit activity</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">High-signal activity across admin and tenant operations.</p>
            </div>
            <Badge tone="info">live view</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {data.recentAuditLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold text-[var(--color-ink)]">{log.action}</p>
                  <Badge tone={log.action === "access.denied" ? "warning" : "neutral"}>
                    {log.targetType}
                  </Badge>
                  {log.organization ? <StatusBadge value={log.organization.status} /> : null}
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {log.actorUser?.fullName ?? "System"} • {log.createdAt.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Feature flag status</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total flags</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{data.featureFlagSummary.total}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Enabled</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-950">{data.featureFlagSummary.enabled}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Disabled</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{data.featureFlagSummary.disabled}</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Recent signups</h2>
          <div className="mt-5 space-y-3">
            {data.recentSignups.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] p-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{user.fullName}</p>
                  <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge value={user.platformRole ?? "none"} />
                  <StatusBadge value={user.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">At-risk organizations</h2>
          <div className="mt-5 space-y-3">
            {data.riskyOrganizations.map((organization) => (
              <div key={organization.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] p-4">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{organization.name}</p>
                  <p className="text-sm text-[var(--color-muted)]">{organization.organizationType}</p>
                </div>
                <StatusBadge value={organization.status} />
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Organizations by type</h2>
          <div className="mt-5 space-y-3">
            {data.organizationsByType.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-[var(--color-ink)]">{row.label}</span>
                <Badge tone="info">{row.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Users by platform role</h2>
          <div className="mt-5 space-y-3">
            {data.usersByPlatformRole.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <RoleBadge value={row.label} />
                <Badge tone="info">{row.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Users by organization role</h2>
          <div className="mt-5 space-y-3">
            {data.usersByOrganizationRole.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <RoleBadge value={row.label} />
                <Badge tone="info">{row.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Billing placeholder metrics</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Active subscriptions</span>
              <Badge tone="success">{data.billingSummary.active}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Trialing subscriptions</span>
              <Badge tone="warning">{data.billingSummary.trialing}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Total subscription rows</span>
              <Badge tone="info">{data.billingSummary.totalSubscriptions}</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Support placeholder metrics</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Recent users</span>
              <Badge tone="info">{data.supportSummary.recentUsers}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Recent org creations</span>
              <Badge tone="info">{data.supportSummary.recentOrganizations}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Support notes backlog</span>
              <Badge tone="neutral">{data.supportSummary.supportNotesPlaceholder}</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Country availability</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
              <span>Active countries</span>
              <Badge tone="success">{data.activeCountries}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
              <span>Disabled countries</span>
              <Badge tone="danger">{data.disabledCountries}</Badge>
            </div>
            {session.countryAssignments.slice(0, 3).map((assignment) => (
              <CountryBadge key={assignment.id} countryCode={assignment.countryCode} />
            ))}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
