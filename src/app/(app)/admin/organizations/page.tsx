import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminShell } from "@/components/admin/admin-shell";
import { CountrySelector } from "@/components/admin/country-selector";
import { CountryBadge } from "@/components/ui/country-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminOrganizations } from "@/server/admin/organizations";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage({
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
  const [organizations, countries] = await Promise.all([
    listAdminOrganizations(session, {
      search: params.search,
      countryCode: params.countryCode,
      organizationType: params.organizationType,
      status: params.status,
      page: params.page,
    }),
    prisma.country.findMany({
      select: { countryCode: true, countryName: true },
      orderBy: { countryName: "asc" },
    }),
  ]);

  return (
    <AdminShell
      session={session}
      title="Organization management"
      description="Review tenants across the platform, filter by country and type, and inspect operational health before product modules launch."
    >
      <AdminFilterBar searchPlaceholder="Search organization name or owner email">
        <CountrySelector countries={countries} defaultValue={params.countryCode ?? ""} />
        <select name="organizationType" defaultValue={params.organizationType ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
          <option value="">All organization types</option>
          <option value="household">household</option>
          <option value="chef_business">chef_business</option>
          <option value="home_catering">home_catering</option>
          <option value="restaurant">restaurant</option>
          <option value="grocery_partner">grocery_partner</option>
          <option value="internal_admin">internal_admin</option>
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="suspended">suspended</option>
          <option value="disabled">disabled</option>
        </select>
      </AdminFilterBar>

      <AdminDataTable
        data={organizations.items}
        emptyMessage="No organizations matched the current filters."
        pagination={organizations.pagination}
        paginationBasePath="/admin/organizations"
        paginationSearchParams={params}
        paginationItemLabel="organizations"
        columns={[
          {
            key: "name",
            header: "Organization",
            render: (organization) => (
              <div>
                <Link href={`/admin/organizations/${organization.id}`} className="font-semibold text-[var(--color-primary)]">
                  {organization.name}
                </Link>
                <p className="text-[var(--color-muted)]">{organization.slug}</p>
              </div>
            ),
          },
          {
            key: "country",
            header: "Country",
            render: (organization) => (
              <CountryBadge
                countryCode={organization.country.countryCode}
                countryName={organization.country.countryName}
              />
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (organization) => (
              <div>
                <p>{organization.organizationType}</p>
                <p className="text-[var(--color-muted)]">{organization._count.memberships} members</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (organization) => <StatusBadge value={organization.status} />,
          },
        ]}
      />
    </AdminShell>
  );
}
