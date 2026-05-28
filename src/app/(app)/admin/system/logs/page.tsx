import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminSystemStatus } from "@/server/admin/system-status";

export const dynamic = "force-dynamic";

export default async function AdminSystemLogsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const status = await getAdminSystemStatus(session);

  return (
    <AdminShell
      session={session}
      title="System logs"
      description="Recent operational failures and audit activity. Provider payloads and secret values are not shown here."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Card><Metric label="Webhook failures" value={status.failures.webhookFailures.length} /></Card>
        <Card><Metric label="Payment failures" value={status.failures.paymentFailures.length} /></Card>
        <Card><Metric label="Storage failures" value={status.failures.storageFailures.length} /></Card>
      </section>

      <AdminDataTable
        data={status.failures.webhookFailures}
        emptyMessage="No failed webhook events found."
        columns={[
          { key: "provider", header: "Provider", render: (event) => <Badge tone="neutral">{event.provider}</Badge> },
          { key: "event", header: "Event", render: (event) => event.eventType },
          { key: "message", header: "Safe message", render: (event) => event.errorMessage ?? "No message stored" },
          { key: "created", header: "Created", render: (event) => event.createdAt.toLocaleString() },
        ]}
      />

      <AdminDataTable
        data={status.failures.paymentFailures}
        emptyMessage="No failed payment orders found."
        columns={[
          { key: "provider", header: "Provider", render: (order) => <Badge tone="neutral">{order.provider}</Badge> },
          { key: "module", header: "Module", render: (order) => order.module },
          { key: "country", header: "Country", render: (order) => order.countryCode },
          { key: "message", header: "Safe message", render: (order) => order.failureMessage ?? order.failureCode ?? "No failure message" },
          { key: "created", header: "Created", render: (order) => order.createdAt.toLocaleString() },
        ]}
      />

      <AdminDataTable
        data={status.latestAuditLogs}
        emptyMessage="No audit logs found."
        columns={[
          { key: "action", header: "Action", render: (log) => log.action },
          { key: "target", header: "Target", render: (log) => log.targetType ?? "platform" },
          { key: "country", header: "Country", render: (log) => log.countryCode ?? "global" },
          { key: "created", header: "Created", render: (log) => log.createdAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
    </>
  );
}
