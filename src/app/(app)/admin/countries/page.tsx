import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminCountries } from "@/server/admin/countries";

export const dynamic = "force-dynamic";

export default async function AdminCountriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const params = await searchParams;
  const [countries, allCountries] = await Promise.all([
    listAdminCountries(session, {
      query: params.search,
      onlyActive: params.onlyActive,
      countryCode: params.countryCode,
      page: params.page,
    }),
    prisma.country.findMany({
      select: { countryCode: true, countryName: true },
      orderBy: { countryName: "asc" },
    }),
  ]);
  const canManageCountries =
    session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Country operations"
      description="Manage expansion-ready country records, localized defaults, activation state, and country-level operators."
      actions={
        session.user.platformRole === "platform_owner" ||
        session.user.platformRole === "platform_admin" ? (
          <Button asChild>
            <Link href="/admin/countries/new">Create country</Link>
          </Button>
        ) : null
      }
    >
      <FormMessage message={params.message} />

      <AdminFilterBar searchPlaceholder="Search country name or code">
        <select
          name="onlyActive"
          defaultValue={params.onlyActive ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select
          name="countryCode"
          defaultValue={params.countryCode ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All seeded countries</option>
          {allCountries.map((country) => (
            <option key={country.countryCode} value={country.countryCode}>
              {country.countryName}
            </option>
          ))}
        </select>
      </AdminFilterBar>

      <AdminDataTable
        data={countries.items}
        emptyMessage="No countries matched the current filters."
        pagination={countries.pagination}
        paginationBasePath="/admin/countries"
        paginationSearchParams={params}
        paginationItemLabel="countries"
        columns={[
          {
            key: "country",
            header: "Country",
            width: "minmax(220px, 1.3fr)",
            render: (country) => (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/countries/${country.countryCode}`}
                  className="font-semibold text-[var(--color-primary)]"
                >
                  {country.countryName}
                </Link>
                <Badge tone="info">{country.countryCode}</Badge>
              </div>
            ),
          },
          {
            key: "defaults",
            header: "Defaults",
            width: "minmax(210px, 1.1fr)",
            render: (country) => (
              <div className="leading-6">
                <p>{country.currencyCode}</p>
                <p className="text-[var(--color-muted)]">
                  {country.defaultLocale} • {country.defaultTimezone}
                </p>
              </div>
            ),
          },
          {
            key: "state",
            header: "State",
            width: "minmax(140px, 0.7fr)",
            render: (country) => (
              <div className="leading-6">
                <StatusBadge value={country.isActive ? "active" : "disabled"} />
                <p className="text-[var(--color-muted)]">{country.measurementSystem}</p>
              </div>
            ),
          },
          {
            key: "managers",
            header: "Managers",
            width: "minmax(170px, 0.8fr)",
            render: (country) => (
              <div className="leading-6">
                <p>{country.countryAssignments.length} assigned</p>
                <p className="text-[var(--color-muted)]">
                  {country._count.organizations} organizations
                </p>
              </div>
            ),
          },
          ...(canManageCountries
            ? [
                {
                  key: "actions",
                  header: "Actions",
                  width: "minmax(190px, 0.8fr)",
                  render: (country: (typeof countries.items)[number]) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="secondary" className="min-h-10 px-3">
                        <Link href={`/admin/countries/${country.countryCode}`}>Manage</Link>
                      </Button>
                      <form action={`/api/admin/countries/${country.countryCode}`} method="post">
                        <input type="hidden" name="countryName" value={country.countryName} />
                        <input type="hidden" name="currencyCode" value={country.currencyCode} />
                        <input type="hidden" name="defaultTimezone" value={country.defaultTimezone} />
                        <input type="hidden" name="defaultLocale" value={country.defaultLocale} />
                        <input type="hidden" name="measurementSystem" value={country.measurementSystem} />
                        <input type="hidden" name="phoneCountryCode" value={country.phoneCountryCode} />
                        {country.supportedModules.map((module) => (
                          <input key={module} type="hidden" name="supportedModules" value={module} />
                        ))}
                        {country.countryAssignments.map((assignment) => (
                          <input
                            key={assignment.userId}
                            type="hidden"
                            name="managerUserIds"
                            value={assignment.userId}
                          />
                        ))}
                        {!country.isActive ? <input type="hidden" name="isActive" value="on" /> : null}
                        <Button
                          type="submit"
                          variant={country.isActive ? "warning" : "success"}
                          className="min-h-10 px-3"
                          aria-label={`${country.isActive ? "Disable" : "Enable"} ${country.countryName}`}
                        >
                          {country.isActive ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </AdminShell>
  );
}
