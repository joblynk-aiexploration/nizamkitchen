import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMarketplacePolicy } from "@/server/policies/policy-service";

export const dynamic = "force-dynamic";

export default async function AdminPolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const policy = await getMarketplacePolicy(session, id);

  return (
    <AdminShell
      session={session}
      title={policy?.name ?? "Policy"}
      description="Policy detail, rules, overrides, and recent evaluation activity."
      actions={<Link href="/admin/policies" className="text-sm font-medium text-[var(--color-primary)] hover:underline">Back to policies</Link>}
    >
      {!policy ? (
        <Card><p className="text-sm text-[var(--color-muted)]">Policy not found.</p></Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">{policy.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{policy.description}</p>
              </div>
              <Badge tone={policy.status === "active" ? "success" : "neutral"}>{policy.status}</Badge>
            </div>
            <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(policy.rulesJson, null, 2)}</pre>
          </Card>

          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Overrides</h2>
            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {policy.overrides.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No overrides for this policy.</p>
              ) : (
                policy.overrides.map((override) => (
                  <div key={override.id} className="py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-[var(--color-ink)]">{override.organization?.name ?? override.user?.email ?? "Scoped override"}</p>
                      <Badge tone={override.status === "active" ? "success" : "neutral"}>{override.status}</Badge>
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">{override.reason}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Recent evaluations</h2>
            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {policy.evaluationLogs.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No evaluations logged yet.</p>
              ) : (
                policy.evaluationLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span>{log.module} · {log.action}</span>
                    <Badge tone={log.result === "allowed" ? "success" : log.result === "denied" ? "danger" : "warning"}>{log.result}</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
