import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";

export const dynamic = "force-dynamic";

export default async function PlatformConfigurationTestsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [params, integrations] = await Promise.all([searchParams, listPlatformIntegrations(session)]);

  const rows = integrations.flatMap((integration) =>
    integration.testLogs.map((log) => ({
      integrationId: integration.id,
      integration: integration.displayName,
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
      title="Integration test logs"
      description="Review safe test output without exposing credential values or provider secrets."
    >
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <AdminDataTable
        data={rows}
        emptyMessage="No integration tests have been logged yet."
        columns={[
          { key: "integration", header: "Integration", render: (item) => item.integration },
          { key: "provider", header: "Provider", render: (item) => item.provider.replace(/_/g, " ") },
          { key: "testType", header: "Test", render: (item) => item.testType.replace(/_/g, " ") },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "success" ? "success" : item.status === "failed" ? "danger" : "neutral"}>{item.status}</Badge> },
          { key: "message", header: "Message", render: (item) => item.message },
          { key: "createdAt", header: "Logged", render: (item) => item.createdAt.toLocaleString() },
          { key: "view", header: "Action", render: (item) => <a className="text-sm font-semibold text-[var(--color-primary)]" href={`/admin/configuration/integrations/${item.integrationId}`}>Open</a> },
        ]}
      />
    </AdminShell>
  );
}
