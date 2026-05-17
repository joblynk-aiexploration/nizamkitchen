import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CountryBadge } from "@/components/ui/country-badge";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const organizations = await prisma.organization.findMany({
    include: { country: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tenant registry"
        title="Organizations"
        description="A platform-wide index of tenants with country and lifecycle metadata."
      />
      <DataTable
        columns={[
          { key: "name", header: "Organization", render: (item) => item.name },
          { key: "type", header: "Type", render: (item) => item.organizationType },
          {
            key: "country",
            header: "Country",
            render: (item) => (
              <CountryBadge countryCode={item.countryCode} countryName={item.country.countryName} />
            ),
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge value={item.status} /> },
        ]}
        data={organizations}
        emptyMessage="No organizations found."
      />
    </div>
  );
}
