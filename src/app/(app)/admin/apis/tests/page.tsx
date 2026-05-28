import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";
import { ApiManagementTabs, providerLabel, StatusBadge } from "../_components";

export const dynamic = "force-dynamic";

export default async function ApiTestsPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrations = await listPlatformIntegrations(session);
  const rows = integrations.flatMap((integration) =>
    integration.testLogs.map((log) => ({
      integrationId: integration.id,
      integrationName: integration.displayName,
      provider: integration.provider,
      testType: log.testType,
      status: log.status,
      message: log.message,
      createdAt: log.createdAt,
    })),
  );

  return (
    <AdminShell
      session={session}
      title="API tests"
      description="Safe API test history. Tests must not create charges, reveal secrets, or log raw credentials."
    >
      <ApiManagementTabs active="/admin/apis/tests" />
      <Card className="text-sm text-[var(--color-muted)]">
        Provider tests validate configuration readiness. Live provider-specific tests are intentionally conservative unless a safe adapter exists.
      </Card>
      <AdminDataTable
        data={rows}
        emptyMessage="No API tests have been logged yet."
        columns={[
          { key: "api", header: "API", render: (item) => <Link href={`/admin/apis/${item.integrationId}`} className="font-semibold text-[var(--color-primary)]">{item.integrationName}</Link> },
          { key: "provider", header: "Provider", render: (item) => providerLabel(item.provider) },
          { key: "type", header: "Test", render: (item) => item.testType.replace(/_/g, " ") },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "message", header: "Message", render: (item) => item.message },
          { key: "date", header: "Date", render: (item) => item.createdAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
