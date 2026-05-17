import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDangerZone } from "@/components/admin/admin-danger-zone";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAdminOrganizationDetail } from "@/server/admin/organizations";

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const { id } = await params;
  const query = await searchParams;
  const organization = await getAdminOrganizationDetail(session, id);
  const owner =
    organization.memberships.find((membership) => membership.role === "org_owner")?.user ??
    organization.memberships[0]?.user ??
    null;
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title={organization.name}
      description="Inspect tenant composition, operational status, enabled controls, and recent admin activity."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/organizations">Back to organizations</Link>
        </Button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <CountryBadge
              countryCode={organization.country.countryCode}
              countryName={organization.country.countryName}
            />
            <StatusBadge value={organization.status} />
            <RoleBadge value={organization.organizationType} />
          </div>
          {canMutate ? (
            <form action={`/api/admin/organizations/${organization.id}`} method="post" className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Organization name
                <input name="name" defaultValue={organization.name} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Slug
                <input name="slug" defaultValue={organization.slug} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Currency
                <input name="currencyCode" defaultValue={organization.currencyCode} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Timezone
                <input name="defaultTimezone" defaultValue={organization.defaultTimezone} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Locale
                <input name="defaultLocale" defaultValue={organization.defaultLocale} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Measurement system
                <input name="measurementSystem" defaultValue={organization.measurementSystem} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <input type="hidden" name="organizationType" value={organization.organizationType} />
              <div className="md:col-span-2">
                <Button type="submit">Update organization metadata</Button>
              </div>
            </form>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Organization detail</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Created</span>
              <span>{organization.createdAt.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Owner</span>
              <span>{owner?.fullName ?? "Unassigned"}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Members</span>
              <span>{organization.memberships.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Billing placeholder</span>
              <span>{organization.billingSubscriptions[0]?.status ?? "not configured"}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminDataTable
          data={organization.memberships}
          emptyMessage="No memberships were found for this organization."
          columns={[
            {
              key: "member",
              header: "Member",
              render: (membership) => (
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{membership.user.fullName}</p>
                  <p className="text-[var(--color-muted)]">{membership.user.email}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              render: (membership) => <RoleBadge value={membership.role} />,
            },
            {
              key: "status",
              header: "Status",
              render: (membership) => <StatusBadge value={membership.status} />,
            },
          ]}
        />

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Enabled feature flags</h2>
          <div className="mt-5 space-y-3">
            {organization.featureFlags.length ? (
              organization.featureFlags.map((flag) => (
                <div key={flag.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>{flag.key}</span>
                  <StatusBadge value={flag.enabled ? "active" : "disabled"} />
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No organization-scoped flags yet.</p>
            )}
          </div>
        </Card>
      </section>

      {canMutate ? (
        <AdminDangerZone
          title="Organization status controls"
          description="These actions affect tenant access across the platform and are fully audit logged."
        >
          {["active", "paused", "suspended", "disabled"].map((status) => (
            <form key={status} action={`/api/admin/organizations/${organization.id}/status`} method="post">
              <input type="hidden" name="status" value={status} />
              <Button type="submit" variant={status === "active" ? "secondary" : "danger"}>
                Set {status}
              </Button>
            </form>
          ))}
        </AdminDangerZone>
      ) : null}

      <AuditLogTable logs={organization.auditLogs} selectedLogId={query.logId ?? null} detailHrefBase={`/admin/organizations/${organization.id}`} />
    </AdminShell>
  );
}
