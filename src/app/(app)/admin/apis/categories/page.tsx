import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listIntegrationTemplates, listPlatformIntegrations } from "@/server/config/platform-config-service";
import { ApiManagementTabs, categoryLabel, StatusBadge } from "../_components";

export const dynamic = "force-dynamic";

export default async function ApiCategoriesPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const [templates, integrations] = await Promise.all([
    Promise.resolve(listIntegrationTemplates()),
    listPlatformIntegrations(session),
  ]);

  const rows = templates.map((template) => {
    const configured = integrations.filter((integration) => integration.provider === template.provider);
    const active = configured.find((integration) => integration.status === "active");
    return {
      ...template,
      configuredCount: configured.length,
      activeStatus: active?.status ?? configured[0]?.status ?? "draft",
      href: configured[0] ? `/admin/apis/${configured[0].id}` : "/admin/apis/new",
    };
  });

  return (
    <AdminShell
      session={session}
      title="APIs and integrations"
      description="Supported API categories and provider templates. Use these templates to create global or country-specific API records."
      actions={<Button asChild><Link href="/admin/apis/new">Add API</Link></Button>}
    >
      <ApiManagementTabs active="/admin/apis/categories" />
      <Card className="text-sm text-[var(--color-muted)]">
        Disabled APIs are not selected by runtime integration helpers. Related UI should fall back to manual entry, setup messages, or in-app-only behavior.
      </Card>
      <AdminDataTable
        data={rows}
        emptyMessage="No API templates are registered."
        columns={[
          { key: "name", header: "API", render: (item) => <Link href={item.href} className="font-semibold text-[var(--color-primary)]">{item.displayName}</Link> },
          { key: "category", header: "Category", render: (item) => categoryLabel(item.category) },
          { key: "configured", header: "Configured", render: (item) => `${item.configuredCount} records` },
          { key: "status", header: "Best status", render: (item) => <StatusBadge status={item.activeStatus} /> },
          { key: "public", header: "Public keys", render: (item) => item.publicCredentialKeys.join(", ") || "none" },
          { key: "secrets", header: "Server secrets", render: (item) => item.serverCredentialKeys.join(", ") || "none" },
        ]}
      />
    </AdminShell>
  );
}
