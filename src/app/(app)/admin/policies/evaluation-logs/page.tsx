import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { listMarketplacePolicyEvaluationLogs } from "@/server/policies/policy-service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPolicyEvaluationLogsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const logs = await listMarketplacePolicyEvaluationLogs(session);

  return (
    <AdminShell session={session} title="Policy Evaluation Logs" description="Recent policy decisions for marketplace actions.">
      <AdminDataTable
        data={logs}
        emptyMessage="No policy evaluations logged yet."
        columns={[
          { key: "policy", header: "Policy", render: (log) => <span className="text-sm">{log.policy?.name ?? "No matching policy"}</span> },
          { key: "action", header: "Action", render: (log) => <span className="text-sm">{log.module} · {log.action}</span> },
          { key: "result", header: "Result", render: (log) => <Badge tone={log.result === "allowed" ? "success" : log.result === "denied" ? "danger" : "warning"}>{log.result}</Badge> },
          { key: "scope", header: "Scope", render: (log) => <span className="text-sm">{log.organization?.name ?? log.user?.email ?? "Platform"}</span> },
          { key: "created", header: "Created", render: (log) => <span className="text-sm text-[var(--color-muted)]">{formatDate(log.createdAt)}</span> },
        ]}
      />
    </AdminShell>
  );
}
