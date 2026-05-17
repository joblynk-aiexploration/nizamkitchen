import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { CountryBadge } from "@/components/ui/country-badge";
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
    }),
    prisma.country.findMany({
      select: { countryCode: true, countryName: true },
      orderBy: { countryName: "asc" },
    }),
  ]);

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
        data={countries}
        emptyMessage="No countries matched the current filters."
        columns={[
          {
            key: "country",
            header: "Country",
            render: (country) => (
              <div className="space-y-2">
                <Link
                  href={`/admin/countries/${country.countryCode}`}
                  className="font-semibold text-[var(--color-primary)]"
                >
                  {country.countryName}
                </Link>
                <CountryBadge
                  countryCode={country.countryCode}
                  countryName={country.countryName}
                />
              </div>
            ),
          },
          {
            key: "defaults",
            header: "Defaults",
            render: (country) => (
              <div>
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
            render: (country) => (
              <div className="space-y-2">
                <StatusBadge value={country.isActive ? "active" : "disabled"} />
                <p className="text-[var(--color-muted)]">{country.measurementSystem}</p>
              </div>
            ),
          },
          {
            key: "managers",
            header: "Managers",
            render: (country) => (
              <div>
                <p>{country.countryAssignments.length} assigned</p>
                <p className="text-[var(--color-muted)]">
                  {country._count.organizations} organizations
                </p>
              </div>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
