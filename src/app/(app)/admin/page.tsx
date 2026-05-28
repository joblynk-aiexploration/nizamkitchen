import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Flag,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/server/admin/dashboard";
import { requirePlatformRole } from "@/lib/auth/session";
import { formatAppDateTime, titleCase } from "@/lib/utils";

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
  const enabledFlagPercent = percentage(data.featureFlagSummary.enabled, data.featureFlagSummary.total);
  const activeSubscriptionPercent = percentage(data.billingSummary.active, data.billingSummary.totalSubscriptions);

  return (
    <AdminShell
      session={session}
      title="Platform admin control center"
      description="Monitor platform operations, tenant health, access controls, and country readiness from one executive workspace."
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
      <section className="overflow-hidden rounded-[2rem] border border-teal-900/20 bg-[radial-gradient(circle_at_top_left,#1f6f62_0%,#123643_38%,#071421_100%)] text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:p-8">
          <div className="flex min-h-[320px] flex-col justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-50">
                <ShieldCheck className="h-4 w-4" />
                Platform scope
              </div>
              <h2 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Enterprise operations overview
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-teal-50/85">
                A live control view for users, organizations, countries, billing posture, feature controls, and security-sensitive activity.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric icon={<Users className="h-4 w-4" />} label="Users" value={data.totalUsers} tone="light" />
              <HeroMetric icon={<Building2 className="h-4 w-4" />} label="Organizations" value={data.totalOrganizations} tone="light" />
              <HeroMetric icon={<Globe2 className="h-4 w-4" />} label="Active countries" value={data.activeCountries} tone="success" />
              <HeroMetric icon={<LockKeyhole className="h-4 w-4" />} label="Denied access" value={data.accessDeniedCount} tone={data.accessDeniedCount > 0 ? "warning" : "success"} />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-5 shadow-xl shadow-slate-950/10 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-50/70">Operational posture</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Control readiness</h3>
              </div>
              <div className="rounded-2xl bg-emerald-300/15 p-3 text-emerald-100">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <PostureRow label="Feature flags enabled" value={`${enabledFlagPercent}%`} detail={`${data.featureFlagSummary.enabled} of ${data.featureFlagSummary.total}`} />
              <PostureRow label="Active subscriptions" value={`${activeSubscriptionPercent}%`} detail={`${data.billingSummary.active} of ${data.billingSummary.totalSubscriptions}`} />
              <PostureRow label="Countries disabled" value={data.disabledCountries} detail="Review before opening new markets" />
              <PostureRow label="At-risk organizations" value={data.riskyOrganizations.length} detail="Disabled or suspended tenants" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/admin/users" className="rounded-2xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-50">
                Manage users
              </Link>
              <Link href="/admin/system/health" className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                System health
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric icon={<Users className="h-5 w-5" />} label="Total users" value={data.totalUsers} hint="Scoped to your permitted admin footprint." href="/admin/users" />
        <OverviewMetric icon={<Building2 className="h-5 w-5" />} label="Organizations" value={data.totalOrganizations} hint="Cross-tenant visibility with server-side isolation." href="/admin/organizations" />
        <OverviewMetric icon={<Flag className="h-5 w-5" />} label="Country availability" value={`${data.activeCountries} active`} hint={`${data.disabledCountries} disabled countries held back from public use.`} href="/admin/countries" />
        <OverviewMetric icon={<AlertTriangle className="h-5 w-5" />} label="Access denied events" value={data.accessDeniedCount} hint="Security-sensitive blocked actions that need review." href="/admin/audit-logs" tone={data.accessDeniedCount > 0 ? "warning" : "success"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Card className="overflow-hidden p-0">
          <SectionHeader
            eyebrow="Audit trail"
            title="Recent platform activity"
            description="Latest 5 high-signal activities across admin and tenant operations."
            action={<HeaderLink href="/admin/audit-logs">View all</HeaderLink>}
          />
          <div className="divide-y divide-[var(--color-border)]">
            {data.recentAuditLogs.length ? data.recentAuditLogs.map((log) => (
              <div key={log.id} className="grid gap-3 p-5 transition hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="break-words font-semibold text-[var(--color-ink)]">{titleCase(log.action)}</p>
                    <Badge tone={log.action === "access.denied" ? "warning" : "neutral"}>{titleCase(log.targetType)}</Badge>
                    {log.organization ? <StatusBadge value={log.organization.status} /> : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {log.actorUser?.fullName ?? "System"} at {formatAppDateTime(log.createdAt, { showTimeZone: true })}
                  </p>
                </div>
                <Link href="/admin/audit-logs" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                  Inspect <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            )) : <EmptyState title="No recent audit activity" description="New admin and access-control activity will appear here." />}
          </div>
        </Card>

        <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f3fbf8_100%)]">
          <SectionTitle eyebrow="Controls" title="Feature and billing posture" />
          <div className="mt-5 space-y-4">
            <ProgressBlock label="Feature flags enabled" value={enabledFlagPercent} detail={`${data.featureFlagSummary.enabled} enabled, ${data.featureFlagSummary.disabled} disabled`} />
            <ProgressBlock label="Active subscriptions" value={activeSubscriptionPercent} detail={`${data.billingSummary.active} active, ${data.billingSummary.trialing} trialing`} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <QuickLink href="/admin/feature-flags" label="Feature flags" detail={`${data.featureFlagSummary.total} total`} />
              <QuickLink href="/admin/billing" label="Billing center" detail={`${data.billingSummary.totalSubscriptions} subscriptions`} />
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="p-0">
          <SectionHeader
            eyebrow="Identity"
            title="Recent signups"
            description="Newest accounts entering the platform."
            action={<HeaderLink href="/admin/users">Manage users</HeaderLink>}
          />
          <div className="divide-y divide-[var(--color-border)]">
            {data.recentSignups.length ? data.recentSignups.map((user) => (
              <div key={user.id} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-ink)]">{user.fullName}</p>
                  <p className="break-words text-sm leading-5 text-[var(--color-muted)]">{user.email}</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                  <RoleBadge value={user.platformRole ?? "none"} />
                  <StatusBadge value={user.status} />
                </div>
              </div>
            )) : <EmptyState title="No users yet" description="New user registrations will appear here." />}
          </div>
        </Card>

        <Card className="p-0">
          <SectionHeader
            eyebrow="Risk"
            title="At-risk organizations"
            description="Disabled or suspended organizations that may need review."
            action={<HeaderLink href="/admin/organizations">Review orgs</HeaderLink>}
          />
          <div className="divide-y divide-[var(--color-border)]">
            {data.riskyOrganizations.length ? data.riskyOrganizations.map((organization) => (
              <div key={organization.id} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-[var(--color-ink)]">{organization.name}</p>
                  <p className="break-words text-sm leading-5 text-[var(--color-muted)]">{titleCase(organization.organizationType)}</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                  <StatusBadge value={organization.status} />
                </div>
              </div>
            )) : <EmptyState title="No at-risk organizations" description="Suspended or disabled organizations will appear here." />}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <BreakdownCard title="Organizations by type" eyebrow="Tenant mix" rows={data.organizationsByType.map((row) => ({ label: titleCase(row.label), value: row.count }))} />
        <BreakdownCard title="Users by platform role" eyebrow="Access model" rows={data.usersByPlatformRole.map((row) => ({ label: <RoleBadge value={row.label} />, value: row.count }))} />
        <BreakdownCard title="Users by organization role" eyebrow="Workspace roles" rows={data.usersByOrganizationRole.map((row) => ({ label: <RoleBadge value={row.label} />, value: row.count }))} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle eyebrow="Revenue operations" title="Billing health" />
          <div className="mt-5 space-y-3">
            <MetricRow label="Active subscriptions" value={<Badge tone="success">{data.billingSummary.active}</Badge>} />
            <MetricRow label="Trialing subscriptions" value={<Badge tone="warning">{data.billingSummary.trialing}</Badge>} />
            <MetricRow label="Total subscription records" value={<Badge tone="info">{data.billingSummary.totalSubscriptions}</Badge>} />
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Support operations" title="Support readiness" />
          <div className="mt-5 space-y-3">
            <MetricRow label="Recent users" value={<Badge tone="info">{data.supportSummary.recentUsers}</Badge>} />
            <MetricRow label="Recent organization creations" value={<Badge tone="info">{data.supportSummary.recentOrganizations}</Badge>} />
            <MetricRow label="Denied access events" value={<Badge tone={data.supportSummary.accessDeniedCount > 0 ? "warning" : "success"}>{data.supportSummary.accessDeniedCount}</Badge>} />
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Markets" title="Country availability" />
          <div className="mt-5 space-y-3">
            <MetricRow label="Active countries" value={<Badge tone="success">{data.activeCountries}</Badge>} />
            <MetricRow label="Disabled countries" value={<Badge tone="danger">{data.disabledCountries}</Badge>} />
            {session.countryAssignments.length ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {session.countryAssignments.slice(0, 4).map((assignment) => (
                  <CountryBadge key={assignment.id} countryCode={assignment.countryCode} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-[var(--color-muted)]">Global scope enabled. No country restriction is applied to this admin view.</p>
            )}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}

function HeroMetric({ icon, label, value, tone = "light" }: { icon: ReactNode; label: string; value: ReactNode; tone?: "light" | "success" | "warning" }) {
  const toneClass = tone === "success"
    ? "border-emerald-200/30 bg-emerald-200/15 text-emerald-50"
    : tone === "warning"
      ? "border-amber-200/35 bg-amber-200/15 text-amber-50"
      : "border-white/15 bg-white/10 text-white";
  return (
    <div className={`rounded-3xl border p-4 backdrop-blur ${toneClass}`}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold uppercase tracking-[0.18em] opacity-75">{label}</span>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function OverviewMetric({ icon, label, value, hint, href, tone = "neutral" }: { icon: ReactNode; label: string; value: ReactNode; hint: string; href: string; tone?: "neutral" | "success" | "warning" }) {
  const iconClass = tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700";
  return (
    <Link href={href} className="group rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10">
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-2xl p-3 ${iconClass}`}>{icon}</div>
        <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-primary)]" />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{hint}</p>
    </Link>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--color-border)] p-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{title}</h2>
    </div>
  );
}

function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-slate-50">
      {children}
    </Link>
  );
}

function PostureRow({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
      </div>
      <p className="mt-1 text-xs text-teal-50/70">{detail}</p>
    </div>
  );
}

function ProgressBlock({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-[var(--color-ink)]">{label}</p>
        <Badge tone={value >= 80 ? "success" : value > 0 ? "info" : "neutral"}>{value}%</Badge>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 transition hover:bg-slate-50">
      <p className="font-semibold text-[var(--color-ink)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{detail}</p>
    </Link>
  );
}

function BreakdownCard({ eyebrow, title, rows }: { eyebrow: string; title: string; rows: Array<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <Card>
      <SectionTitle eyebrow={eyebrow} title={title} />
      <div className="mt-5 space-y-3">
        {rows.length ? rows.map((row, index) => (
          <MetricRow key={index} label={row.label} value={<Badge tone="info">{row.value}</Badge>} />
        )) : <EmptyState title="No records yet" description="This breakdown will appear after records are created." compact />}
      </div>
    </Card>
  );
}

function MetricRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="min-w-0 break-words text-sm text-[var(--color-ink)]">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "p-4" : "p-6"} text-center`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="mt-3 font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  );
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
