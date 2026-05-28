import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import { listEmailLogs } from "@/server/email/email-template-service";
import { EmailCenterTabs, EmailStatusBadge, emailProviderLabel } from "../_components";

export const dynamic = "force-dynamic";

export default async function EmailLogsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const logs = await listEmailLogs(session);

  return (
    <AdminShell session={session} title="Email logs" description="Every email send attempt is logged with safe delivery status and failure messages. Secrets are never logged.">
      <EmailCenterTabs active="/admin/emails/logs" />
      <AdminDataTable
        data={logs}
        emptyMessage="No email logs yet."
        columns={[
          {
            key: "message",
            header: "Message",
            width: "minmax(0,1.4fr)",
            render: (log) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{log.subject}</p>
                <p className="text-xs text-[var(--color-muted)]">{log.templateKey ?? "custom"} · {log.recipientEmail}</p>
              </div>
            ),
          },
          { key: "category", header: "Category", render: (log) => <Badge tone="neutral">{log.category}</Badge> },
          { key: "status", header: "Status", render: (log) => <EmailStatusBadge status={log.status} /> },
          { key: "provider", header: "Provider", render: (log) => <span className="text-sm">{emailProviderLabel(log.provider)}</span> },
          { key: "error", header: "Failure", render: (log) => <span className="text-sm text-[var(--color-muted)]">{log.errorMessage ?? "None"}</span> },
          { key: "created", header: "Created", render: (log) => <span className="text-sm text-[var(--color-muted)]">{formatDate(log.createdAt)}</span> },
        ]}
      />
    </AdminShell>
  );
}
