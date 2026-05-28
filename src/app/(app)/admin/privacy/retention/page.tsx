import { DataCategory } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listRetentionPolicies, retentionWarningForCategory } from "@/server/privacy/privacy-service";
import { upsertRetentionPolicyAction } from "../actions";

export const dynamic = "force-dynamic";

const categories = Object.values(DataCategory);

export default async function AdminRetentionPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const policies = await listRetentionPolicies(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Data Retention Policies"
      description="Configure country-aware retention actions by data category. Policies guide manual/admin-reviewed processing."
    >
      {canManage ? (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Create retention policy</h2>
          <form action={upsertRetentionPolicyAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Country
              <input name="countryCode" placeholder="Global or US" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Category
              <select name="dataCategory" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Retention days
              <input name="retentionDays" type="number" min="1" placeholder="Optional" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Action
              <select name="action" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                {["retain", "archive", "anonymize", "delete"].map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Status
              <select name="status" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)] md:col-span-3">
              Notes
              <textarea name="notes" rows={3} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <div><Button type="submit">Save policy</Button></div>
          </form>
        </Card>
      ) : null}
      <AdminDataTable
        data={policies}
        emptyMessage="No retention policies configured."
        columns={[
          { key: "category", header: "Category", render: (policy) => <Badge tone="neutral">{policy.dataCategory}</Badge> },
          { key: "scope", header: "Scope", render: (policy) => <span className="text-sm">{policy.countryCode ?? "Global"}</span> },
          { key: "action", header: "Action", render: (policy) => <Badge tone={policy.action === "delete" ? "danger" : policy.action === "retain" ? "success" : "warning"}>{policy.action}</Badge> },
          { key: "days", header: "Days", render: (policy) => <span className="text-sm">{policy.retentionDays ?? "Not set"}</span> },
          { key: "warning", header: "Warning", render: (policy) => <span className="text-sm text-[var(--color-muted)]">{retentionWarningForCategory(policy.dataCategory) ?? policy.notes ?? "Review before applying."}</span> },
        ]}
      />
    </AdminShell>
  );
}
