import { requirePlatformRole } from "@/lib/session";
import { listManageableCountries } from "@/server/countries";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminCountriesPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
  ]);
  const visibleCountries = await listManageableCountries(session);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Country controls"
        title="Countries"
        description="Country managers only see their assigned countries, while platform administrators can oversee the full country matrix."
      />
      <DataTable
        columns={[
          { key: "country", header: "Country", render: (item) => `${item.countryName} (${item.countryCode})` },
          { key: "currency", header: "Currency", render: (item) => item.currencyCode },
          { key: "timezone", header: "Timezone", render: (item) => item.defaultTimezone },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <Badge tone={item.isActive ? "success" : "danger"}>
                {item.isActive ? "active" : "inactive"}
              </Badge>
            ),
          },
        ]}
        data={visibleCountries}
        emptyMessage="No countries are assigned to this manager."
      />
    </div>
  );
}
