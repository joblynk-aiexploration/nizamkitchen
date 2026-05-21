import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";
import { ApiManagementTabs, providerLabel } from "../_components";

export const dynamic = "force-dynamic";

export default async function ApiPublicKeysPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrations = await listPlatformIntegrations(session);
  const rows = integrations.flatMap((integration) =>
    integration.credentials
      .filter((credential) => credential.isPublicClientValue)
      .map((credential) => ({
        integrationId: integration.id,
        integrationName: integration.displayName,
        provider: integration.provider,
        keyName: credential.keyName,
        valuePreview: credential.valuePreview,
        updatedAt: credential.updatedAt,
      })),
  );

  return (
    <AdminShell
      session={session}
      title="Public API keys"
      description="Browser-safe IDs and public keys that were explicitly marked public-client safe."
    >
      <ApiManagementTabs active="/admin/apis/public-keys" />
      <Card className="text-sm text-[var(--color-muted)]">
        Public keys can appear in browser payloads only when intentionally marked public. Server secrets must stay on the secrets tab.
      </Card>
      <AdminDataTable
        data={rows}
        emptyMessage="No public-client API keys have been saved yet."
        columns={[
          { key: "api", header: "API", render: (item) => <Link href={`/admin/apis/${item.integrationId}`} className="font-semibold text-[var(--color-primary)]">{item.integrationName}</Link> },
          { key: "provider", header: "Provider", render: (item) => providerLabel(item.provider) },
          { key: "key", header: "Key", render: (item) => item.keyName },
          { key: "preview", header: "Masked preview", render: (item) => item.valuePreview },
          { key: "updated", header: "Updated", render: (item) => item.updatedAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
