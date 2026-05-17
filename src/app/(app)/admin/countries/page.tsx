import { requirePlatformRole } from "@/lib/auth/session";
import { canManageCountry } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
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
  const assignments = await prisma.countryAssignment.findMany({
    where: { userId: session.user.id },
  });
  const countries = await prisma.country.findMany({
    orderBy: { countryName: "asc" },
  });

  const allowedCountryCodes = assignments.map((assignment) => assignment.countryCode);
  const visibleCountries =
    session.user.platformRole === "country_manager"
      ? countries.filter((country) =>
          canManageCountry({
            platformRole: session.user.platformRole,
            assignedCountries: allowedCountryCodes,
            countryCode: country.countryCode,
          }),
        )
      : countries;

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
