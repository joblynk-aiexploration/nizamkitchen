import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMarketplacePolicies } from "@/server/policies/policy-service";

export const dynamic = "force-dynamic";

export default async function AdminPoliciesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const policies = await listMarketplacePolicies(session);

  return (
    <AdminShell
      session={session}
      title="Marketplace Policies"
      description="Central policy controls for marketplace behavior, verification gates, payments, refunds, and public profile rules."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="secondary"><Link href="/admin/policies/overrides">Overrides</Link></Button>
          <Button asChild><Link href="/admin/policies/new">New policy</Link></Button>
        </div>
      }
    >
      <AdminDataTable
        data={policies}
        emptyMessage="No marketplace policies found."
        columns={[
          {
            key: "name",
            header: "Policy",
            render: (policy) => (
              <div>
                <Link href={`/admin/policies/${policy.id}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">
                  {policy.name}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">{policy.description ?? "No description"}</p>
              </div>
            ),
          },
          { key: "module", header: "Module", render: (policy) => <Badge tone="neutral">{policy.module}</Badge> },
          { key: "status", header: "Status", render: (policy) => <Badge tone={policy.status === "active" ? "success" : "neutral"}>{policy.status}</Badge> },
          { key: "scope", header: "Scope", render: (policy) => <span className="text-sm">{policy.countryCode ?? "Global"}{policy.sellerType ? ` · ${policy.sellerType}` : ""}</span> },
          { key: "priority", header: "Priority", render: (policy) => <span className="text-sm">{policy.priority}</span> },
          { key: "activity", header: "Activity", render: (policy) => <span className="text-sm text-[var(--color-muted)]">{policy._count.overrides} overrides · {policy._count.evaluationLogs} evals</span> },
        ]}
      />
    </AdminShell>
  );
}
