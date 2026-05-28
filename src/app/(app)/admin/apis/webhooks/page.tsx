import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";
import { ApiManagementTabs, providerLabel, scopeLabel, StatusBadge } from "../_components";

export const dynamic = "force-dynamic";

export default async function ApiWebhooksPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrations = await listPlatformIntegrations(session);
  const rows = integrations.map((integration) => {
    const webhookSettings = integration.settings.filter((setting) => /webhook|callback/i.test(setting.settingKey));
    const webhookSecrets = integration.credentials.filter((credential) => /webhook/i.test(credential.keyName));
    return {
      id: integration.id,
      displayName: integration.displayName,
      provider: integration.provider,
      status: integration.status,
      scope: scopeLabel(integration),
      webhookSettings,
      webhookSecrets,
    };
  });

  return (
    <AdminShell
      session={session}
      title="API webhooks"
      description="Webhook and callback URL inventory across APIs. Webhook secrets remain encrypted and masked."
    >
      <ApiManagementTabs active="/admin/apis/webhooks" />
      <Card className="text-sm text-[var(--color-muted)]">
        Configure webhook URLs as settings and webhook secrets as encrypted credentials on the API detail page.
      </Card>
      <AdminDataTable
        data={rows}
        emptyMessage="No API records are configured yet."
        columns={[
          { key: "api", header: "API", render: (item) => <Link href={`/admin/apis/${item.id}`} className="font-semibold text-[var(--color-primary)]">{item.displayName}</Link> },
          { key: "provider", header: "Provider", render: (item) => providerLabel(item.provider) },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "scope", header: "Scope", render: (item) => item.scope },
          { key: "urls", header: "URLs / callbacks", render: (item) => item.webhookSettings.length ? item.webhookSettings.map((setting) => setting.settingKey).join(", ") : "Not configured" },
          { key: "secrets", header: "Webhook secrets", render: (item) => item.webhookSecrets.length ? item.webhookSecrets.map((credential) => credential.valuePreview).join(", ") : "Not configured" },
        ]}
      />
    </AdminShell>
  );
}
