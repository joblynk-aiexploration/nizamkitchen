import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { FormMessage } from "@/components/ui/form-message";
import { StatusBadge } from "@/components/ui/status-badge";
import { getKnownTimeZonesForCountry } from "@/lib/timezones";
import { getAdminCountryDetail } from "@/server/admin/countries";

const moduleOptions = [
  "recipes",
  "meal_planner",
  "grocery_engine",
  "youtube_references",
  "home_chefs",
  "home_catering",
  "restaurant_fallback",
  "grocery_partners",
  "menus",
  "restaurant_profiles",
  "payments",
  "subscriptions",
  "ai_suggestions",
  "country_specific_recipes",
  "chef_verification",
  "family_profiles",
  "occasion_planning",
  "ramadan_mode",
  "eid_mode",
];

export default async function CountryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const { code } = await params;
  const query = await searchParams;
  const { country, users } = await getAdminCountryDetail(session, code);
  const managers = await prisma.user.findMany({
    where: { platformRole: "country_manager", status: "active" },
    orderBy: { fullName: "asc" },
  });
  const countryTimeZones = getKnownTimeZonesForCountry(country.countryCode, country.defaultTimezone);
  const selectedManagers = new Set(country.countryAssignments.map((assignment) => assignment.userId));
  const canEdit = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin" || session.user.platformRole === "country_manager";
  const canManageCountryActivation =
    session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title={`${country.countryName} controls`}
      description="Review localized defaults, operator assignments, tenant footprint, and recent audit activity for this country."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/countries">Back to countries</Link>
        </Button>
      }
    >
      <FormMessage message={query.message} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <CountryBadge countryCode={country.countryCode} countryName={country.countryName} />
            <StatusBadge value={country.isActive ? "active" : "disabled"} />
          </div>
          <form action={`/api/admin/countries/${country.countryCode}`} method="post" className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Country name
                <input name="countryName" defaultValue={country.countryName} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Currency code
                <input name="currencyCode" defaultValue={country.currencyCode} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Default timezone
                <select name="defaultTimezone" defaultValue={country.defaultTimezone} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                  {countryTimeZones.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>{timeZone}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Default locale
                <input name="defaultLocale" defaultValue={country.defaultLocale} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Measurement system
                <select name="measurementSystem" defaultValue={country.measurementSystem} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                  <option value="imperial">Imperial</option>
                  <option value="metric">Metric</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Phone country code
                <input name="phoneCountryCode" defaultValue={country.phoneCountryCode} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3" />
              </label>
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">Supported modules</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {moduleOptions.map((module) => (
                  <label key={module} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-sm">
                    <input
                      type="checkbox"
                      name="supportedModules"
                      value={module}
                      defaultChecked={country.supportedModules.includes(module)}
                    />
                    <span>{module}</span>
                  </label>
                ))}
              </div>
            </div>

            {(session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin") ? (
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">Country managers</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {managers.map((manager) => (
                    <label key={manager.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-sm">
                      <input
                        type="checkbox"
                        name="managerUserIds"
                        value={manager.id}
                        defaultChecked={selectedManagers.has(manager.id)}
                      />
                      <span>{manager.fullName} ({manager.email})</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {canManageCountryActivation ? (
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={country.isActive} />
                <span>Country is active</span>
              </label>
            ) : (
              <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
                <p className="font-semibold text-[var(--color-ink)]">Activation status</p>
                <p className="mt-1">
                  This country is currently {country.isActive ? "active" : "disabled"}. Platform Owner or
                  Platform Admin can enable or disable country availability.
                </p>
              </div>
            )}
            {canEdit ? <Button type="submit">Save country settings</Button> : null}
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Country snapshot</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Organizations</span>
              <span className="font-semibold">{country.organizations.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Users in scope</span>
              <span className="font-semibold">{users.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Assigned managers</span>
              <span className="font-semibold">{country.countryAssignments.length}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminDataTable
          data={country.organizations}
          emptyMessage="No organizations are currently mapped to this country."
          columns={[
            {
              key: "name",
              header: "Organization",
              render: (organization) => (
                <div>
                  <Link href={`/admin/organizations/${organization.id}`} className="font-semibold text-[var(--color-primary)]">
                    {organization.name}
                  </Link>
                  <p className="text-[var(--color-muted)]">{organization.organizationType}</p>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (organization) => <StatusBadge value={organization.status} />,
            },
            {
              key: "members",
              header: "Members",
              render: (organization) => <span>{organization.memberships.length}</span>,
            },
          ]}
        />

        <AdminDataTable
          data={users}
          emptyMessage="No users are currently associated with this country."
          columns={[
            {
              key: "user",
              header: "User",
              render: (user) => (
                <div>
                  <Link href={`/admin/users/${user.id}`} className="font-semibold text-[var(--color-primary)]">
                    {user.fullName}
                  </Link>
                  <p className="text-[var(--color-muted)]">{user.email}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Platform role",
              render: (user) => <StatusBadge value={user.platformRole ?? "none"} />,
            },
            {
              key: "status",
              header: "Status",
              render: (user) => <StatusBadge value={user.status} />,
            },
          ]}
        />
      </section>

      <AuditLogTable logs={country.auditLogs} selectedLogId={query.logId ?? null} detailHrefBase={`/admin/countries/${country.countryCode}`} />
    </AdminShell>
  );
}
