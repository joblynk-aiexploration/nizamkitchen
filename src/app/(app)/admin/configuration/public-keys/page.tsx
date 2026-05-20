import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";

export const dynamic = "force-dynamic";

export default async function PlatformPublicKeysPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const integrations = await listPlatformIntegrations(session);
  const rows = integrations.flatMap((integration) =>
    integration.credentials
      .filter((credential) => credential.isPublicClientValue)
      .map((credential) => ({
        integrationId: integration.id,
        integration: integration.displayName,
        provider: integration.provider,
        countryCode: integration.countryCode ?? "global",
        keyName: credential.keyName,
        preview: credential.valuePreview,
        status: integration.status,
      })),
  );

  return (
    <AdminShell
      session={session}
      title="Public client keys"
      description="Review browser-safe values that are explicitly marked public, such as analytics IDs or public site keys."
    >
      <AdminDataTable
        data={rows}
        emptyMessage="No public client values are marked yet."
        columns={[
          { key: "integration", header: "Integration", render: (item) => item.integration },
          { key: "provider", header: "Provider", render: (item) => item.provider.replace(/_/g, " ") },
          { key: "scope", header: "Scope", render: (item) => item.countryCode },
          { key: "key", header: "Key name", render: (item) => item.keyName },
          { key: "preview", header: "Preview", render: (item) => item.preview },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status}</Badge> },
          { key: "view", header: "Action", render: (item) => <a className="text-sm font-semibold text-[var(--color-primary)]" href={`/admin/configuration/integrations/${item.integrationId}`}>Open</a> },
        ]}
      />
    </AdminShell>
  );
}
