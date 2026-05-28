import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { listMarketplacePolicyOverrides } from "@/server/policies/policy-service";

export const dynamic = "force-dynamic";

export default async function AdminPolicyOverridesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const overrides = await listMarketplacePolicyOverrides(session);

  return (
    <AdminShell session={session} title="Policy Overrides" description="Temporary organization or user exceptions to marketplace policies.">
      <AdminDataTable
        data={overrides}
        emptyMessage="No policy overrides found."
        columns={[
          { key: "policy", header: "Policy", render: (override) => <span className="font-medium">{override.policy.name}</span> },
          { key: "scope", header: "Scope", render: (override) => <span className="text-sm">{override.organization?.name ?? override.user?.email ?? "Unknown"}</span> },
          { key: "status", header: "Status", render: (override) => <Badge tone={override.status === "active" ? "success" : "neutral"}>{override.status}</Badge> },
          { key: "reason", header: "Reason", render: (override) => <span className="text-sm text-[var(--color-muted)]">{override.reason}</span> },
          { key: "expires", header: "Expires", render: (override) => <span className="text-sm">{override.expiresAt ? override.expiresAt.toLocaleDateString() : "No expiry"}</span> },
        ]}
      />
    </AdminShell>
  );
}
