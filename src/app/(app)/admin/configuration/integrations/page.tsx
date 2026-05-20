import Link from "next/link";
import { IntegrationEnvironment, IntegrationStatus } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";

export const dynamic = "force-dynamic";

export default async function PlatformIntegrationsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [params, integrations] = await Promise.all([searchParams, listPlatformIntegrations(session)]);
  const canManage = ["platform_owner", "platform_admin", "country_manager"].includes(session.user.platformRole ?? "");

  return (
    <AdminShell
      session={session}
      title="Platform integrations"
      description="Manage global and country-specific provider records, encrypted credentials, and provider settings."
    >
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Provider registry</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Each integration record can hold multiple masked credentials, callback URLs, country-specific overrides, and safe test logs.</p>
        </div>
        {canManage ? <Button asChild><Link href="/admin/configuration/integrations/new">Create integration</Link></Button> : null}
      </Card>

      <AdminDataTable
        data={integrations}
        emptyMessage="No integrations configured yet."
        columns={[
          {
            key: "displayName",
            header: "Integration",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{item.displayName}</p>
                <p className="text-xs text-[var(--color-muted)]">{String(item.provider).replace(/_/g, " ")}</p>
              </div>
            ),
          },
          { key: "category", header: "Category", render: (item) => String(item.category).replace(/_/g, " ") },
          {
            key: "status",
            header: "Status",
            render: (item) => <Badge tone={statusTone(item.status)}>{String(item.status)}</Badge>,
          },
          {
            key: "environment",
            header: "Environment",
            render: (item) => (
              <Badge tone={item.environment === IntegrationEnvironment.production ? "success" : "neutral"}>
                {String(item.environment)}
              </Badge>
            ),
          },
          { key: "scope", header: "Scope", render: (item) => `${item.countryCode ?? "global"}${item.region ? ` / ${item.region}` : ""}` },
          { key: "credentials", header: "Credentials", render: (item) => `${item.credentials.length} saved` },
          { key: "test", header: "Last test", render: (item) => item.lastTestStatus === "not_tested" ? "Not tested" : `${item.lastTestStatus} · ${item.lastTestedAt ? item.lastTestedAt.toLocaleDateString() : "pending"}` },
          {
            key: "action",
            header: "Action",
            render: (item) => <a className="text-sm font-semibold text-[var(--color-primary)]" href={`/admin/configuration/integrations/${item.id}`}>View</a>,
          },
        ]}
      />
    </AdminShell>
  );
}

function statusTone(status: IntegrationStatus) {
  if (status === IntegrationStatus.active) return "success";
  if (status === IntegrationStatus.error) return "danger";
  if (status === IntegrationStatus.disabled) return "warning";
  return "neutral";
}
