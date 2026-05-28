import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { CountryBadge } from "@/components/ui/country-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminCountries } from "@/server/admin/countries";

export default async function MyCountriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
  ]);
  const params = await searchParams;
  const countries = await listAdminCountries(session, { page: params.page });

  return (
    <AdminShell
      session={session}
      title="My countries"
      description="Country managers and global admins can review assigned-country controls without leaking into unassigned markets."
    >
      <AdminDataTable
        data={countries.items}
        emptyMessage="No country assignments were found."
        pagination={countries.pagination}
        paginationBasePath="/admin/my-countries"
        paginationSearchParams={params}
        paginationItemLabel="countries"
        columns={[
          {
            key: "country",
            header: "Country",
            render: (country) => (
              <div>
                <Link href={`/admin/my-countries/${country.countryCode}`} className="font-semibold text-[var(--color-primary)]">
                  {country.countryName}
                </Link>
                <CountryBadge countryCode={country.countryCode} countryName={country.countryName} />
              </div>
            ),
          },
          {
            key: "state",
            header: "State",
            render: (country) => <StatusBadge value={country.isActive ? "active" : "disabled"} />,
          },
        ]}
      />
    </AdminShell>
  );
}
