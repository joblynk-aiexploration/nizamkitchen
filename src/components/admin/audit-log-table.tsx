import Link from "next/link";
import type { AuditLog, Country, Organization, User } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { JsonViewer } from "@/components/admin/json-viewer";
import { Badge } from "@/components/ui/badge";
import { CountryBadge } from "@/components/ui/country-badge";
import { StatusBadge } from "@/components/ui/status-badge";

type AuditRow = AuditLog & {
  actorUser?: User | null;
  organization?: Organization | null;
  country?: Country | null;
};

function severityTone(action: string) {
  if (action === "access.denied") {
    return "warning";
  }
  if (action.includes("disabled") || action.includes("suspended") || action.includes("revoked")) {
    return "danger";
  }
  return "neutral";
}

export function AuditLogTable({
  logs,
  detailHrefBase = "/admin/audit-logs",
  selectedLogId,
}: {
  logs: AuditRow[];
  detailHrefBase?: string;
  selectedLogId?: string | null;
}) {
  const selected = selectedLogId ? logs.find((log) => log.id === selectedLogId) ?? null : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
      <AdminDataTable
        data={logs}
        emptyMessage="No audit events matched the current filters."
        columns={[
          {
            key: "action",
            header: "Action",
            render: (log) => (
              <div className="space-y-2">
                <Link
                  href={`${detailHrefBase}?logId=${log.id}`}
                  className="font-semibold text-[var(--color-primary)]"
                >
                  {log.action}
                </Link>
                <Badge tone={severityTone(log.action)}>{log.targetType}</Badge>
              </div>
            ),
          },
          {
            key: "actor",
            header: "Actor",
            render: (log) => (
              <div>
                <p className="font-medium">{log.actorUser?.fullName ?? "System"}</p>
                <p className="text-[var(--color-muted)]">{log.actorUser?.email ?? "n/a"}</p>
              </div>
            ),
          },
          {
            key: "scope",
            header: "Scope",
            render: (log) => (
              <div className="space-y-2">
                {log.country ? (
                  <CountryBadge
                    countryCode={log.country.countryCode}
                    countryName={log.country.countryName}
                  />
                ) : (
                  <StatusBadge value="global" />
                )}
                <p className="text-[var(--color-muted)]">{log.organization?.name ?? "No org scope"}</p>
              </div>
            ),
          },
          {
            key: "createdAt",
            header: "Timestamp",
            render: (log) => (
              <div>
                <p>{log.createdAt.toLocaleDateString()}</p>
                <p className="text-[var(--color-muted)]">{log.createdAt.toLocaleTimeString()}</p>
              </div>
            ),
          },
        ]}
      />
      <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Event details</h2>
          <Badge tone="info">JSON viewer</Badge>
        </div>
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-ink)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Event
                </p>
                <p className="mt-1 font-medium">{selected.action}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Target
                </p>
                <p className="mt-1">
                  {selected.targetType} {selected.targetId ? `(${selected.targetId})` : ""}
                </p>
              </div>
            </div>
            <JsonViewer value={selected.details ?? {}} />
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            Select an audit event to inspect metadata and operational context.
          </p>
        )}
      </div>
    </div>
  );
}
