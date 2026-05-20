import Link from "next/link";
import { SystemAlertSeverity, SystemAlertStatus } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSystemAlerts } from "@/server/observability/system-alerts";

export const dynamic = "force-dynamic";

export default async function AdminSystemAlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const params = await searchParams;
  const alerts = await listSystemAlerts(session, {
    status: enumValue(SystemAlertStatus, params.status),
    severity: enumValue(SystemAlertSeverity, params.severity),
    type: params.type,
  });

  return (
    <AdminShell
      session={session}
      title="System alerts"
      description="Operational alerts for failed webhooks, storage checks, integration failures, and other launch-critical issues."
    >
      <Card>
        <form className="grid gap-4 md:grid-cols-4">
          <SelectInput label="Status" name="status" defaultValue={params.status ?? ""} options={enumOptions(SystemAlertStatus)} />
          <SelectInput label="Severity" name="severity" defaultValue={params.severity ?? ""} options={enumOptions(SystemAlertSeverity)} />
          <TextInput label="Type contains" name="type" defaultValue={params.type ?? ""} />
          <div className="flex items-end"><Button type="submit">Filter</Button></div>
        </form>
      </Card>

      <AdminDataTable
        data={alerts}
        emptyMessage="No system alerts match the current filters."
        columns={[
          { key: "title", header: "Alert", render: (alert) => <div><Link className="font-semibold text-[var(--color-primary)]" href={`/admin/system/alerts/${alert.id}`}>{alert.title}</Link><p className="text-xs text-[var(--color-muted)]">{alert.type}</p></div> },
          { key: "severity", header: "Severity", render: (alert) => <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge> },
          { key: "status", header: "Status", render: (alert) => <Badge tone={alert.status === "open" ? "warning" : "success"}>{alert.status}</Badge> },
          { key: "created", header: "Created", render: (alert) => alert.createdAt.toLocaleString() },
          { key: "actions", header: "Actions", render: (alert) => <Link className="text-sm font-semibold text-[var(--color-primary)]" href={`/admin/system/alerts/${alert.id}`}>Details</Link> },
        ]}
      />
    </AdminShell>
  );
}

function enumOptions(values: Record<string, string>) {
  return [{ value: "", label: "All" }, ...Object.values(values).map((value) => ({ value, label: value.replace(/_/g, " ") }))];
}

function enumValue<T extends Record<string, string>>(values: T, value?: string) {
  return value && Object.values(values).includes(value) ? value as T[keyof T] : undefined;
}

function severityTone(severity: string): "info" | "warning" | "danger" {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}
