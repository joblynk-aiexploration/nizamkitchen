import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  await requirePlatformRole(["platform_owner", "platform_admin"]);
  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Progressive delivery"
        title="Feature flags"
        description="Future modules are represented as flags now but remain disabled until their implementation is ready."
      />
      <DataTable
        columns={[
          { key: "key", header: "Flag", render: (item) => <span className="font-semibold">{item.key}</span> },
          { key: "name", header: "Name", render: (item) => item.name },
          {
            key: "enabled",
            header: "Enabled",
            render: (item) => (
              <Badge tone={item.enabled ? "success" : "warning"}>
                {item.enabled ? "enabled" : "disabled"}
              </Badge>
            ),
          },
          { key: "scope", header: "Scope", render: (item) => item.organizationId ?? item.countryCode ?? "global" },
        ]}
        data={flags}
        emptyMessage="No feature flags configured."
      />
    </div>
  );
}
