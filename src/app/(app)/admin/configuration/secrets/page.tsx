import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";

export const dynamic = "force-dynamic";

export default async function PlatformSecretsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  const integrations = await listPlatformIntegrations(session);
  const rows = integrations.flatMap((integration) =>
    integration.credentials
      .filter((credential) => !credential.isPublicClientValue)
      .map((credential) => ({
        integrationId: integration.id,
        integration: integration.displayName,
        provider: integration.provider,
        countryCode: integration.countryCode ?? "global",
        keyName: credential.keyName,
        preview: credential.valuePreview,
        updatedAt: credential.updatedAt,
      })),
  );

  return (
    <AdminShell
      session={session}
      title="Masked integration secrets"
      description="Audit encrypted secret coverage without ever revealing the full underlying values."
    >
      <AdminDataTable
        data={rows}
        emptyMessage="No encrypted integration credentials saved yet."
        columns={[
          { key: "integration", header: "Integration", render: (item) => item.integration },
          { key: "provider", header: "Provider", render: (item) => item.provider.replace(/_/g, " ") },
          { key: "scope", header: "Scope", render: (item) => item.countryCode },
          { key: "key", header: "Key name", render: (item) => item.keyName },
          { key: "preview", header: "Masked preview", render: (item) => <Badge tone="warning">{item.preview}</Badge> },
          { key: "updated", header: "Updated", render: (item) => item.updatedAt.toLocaleDateString() },
          { key: "view", header: "Action", render: (item) => <a className="text-sm font-semibold text-[var(--color-primary)]" href={`/admin/configuration/integrations/${item.integrationId}`}>Open</a> },
        ]}
      />
    </AdminShell>
  );
}
