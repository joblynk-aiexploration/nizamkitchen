import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations, platformConfigurationOperationalStatus } from "@/server/config/platform-config-service";
import { ApiManagementTabs, providerLabel } from "../_components";

export const dynamic = "force-dynamic";

export default async function ApiSecretsPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrations = await listPlatformIntegrations(session);
  const status = platformConfigurationOperationalStatus();
  const rows = integrations.flatMap((integration) =>
    integration.credentials
      .filter((credential) => !credential.isPublicClientValue)
      .map((credential) => ({
        integrationId: integration.id,
        integrationName: integration.displayName,
        provider: integration.provider,
        keyName: credential.keyName,
        valuePreview: credential.valuePreview,
        rotatedAt: credential.rotatedAt,
        updatedAt: credential.updatedAt,
      })),
  );

  return (
    <AdminShell
      session={session}
      title="API secrets"
      description="Masked server-only credentials. Full secret values are never displayed after save."
    >
      <ApiManagementTabs active="/admin/apis/secrets" />
      <Card className="text-sm text-[var(--color-muted)]">
        Encryption status: <strong>{status.encryptionConfigured ? "configured" : "missing ENCRYPTION_KEY"}</strong>. Rotate secrets from each API detail page.
      </Card>
      <AdminDataTable
        data={rows}
        emptyMessage="No server-only API secrets have been saved yet."
        columns={[
          { key: "api", header: "API", render: (item) => <Link href={`/admin/apis/${item.integrationId}`} className="font-semibold text-[var(--color-primary)]">{item.integrationName}</Link> },
          { key: "provider", header: "Provider", render: (item) => providerLabel(item.provider) },
          { key: "key", header: "Key", render: (item) => item.keyName },
          { key: "preview", header: "Masked preview", render: (item) => item.valuePreview },
          { key: "rotated", header: "Rotated", render: (item) => item.rotatedAt ? item.rotatedAt.toLocaleString() : "Not rotated" },
        ]}
      />
    </AdminShell>
  );
}
