import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listCreditAccounts } from "@/server/promotions";
import { grantPlatformCreditAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const accounts = await listCreditAccounts();
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Platform credits" description="Grant and audit platform credit balances without touching payment ledger records.">
      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Grant credit</h2>
          <form action={grantPlatformCreditAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput label="Organization ID" name="organizationId" placeholder="Optional if user ID is provided" />
            <TextInput label="User ID" name="userId" placeholder="Optional if organization ID is provided" />
            <TextInput label="Currency" name="currencyCode" defaultValue="USD" maxLength={3} required />
            <TextInput label="Amount" name="amount" type="number" min="0.01" step="0.01" required />
            <div className="md:col-span-2">
              <TextArea label="Reason" name="reason" />
            </div>
            <div className="md:col-span-2"><Button type="submit">Grant credit</Button></div>
          </form>
        </Card>
      ) : null}

      {accounts.length === 0 ? <EmptyState title="No credit accounts" description="Credit accounts are created when Platform Owner grants credit." /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="py-3 pr-4">Owner</th>
                <th className="py-3 pr-4">Balance</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Recent ledger</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[var(--color-ink)]">{account.organizationId ?? account.userId ?? "Unassigned"}</p>
                    <p className="text-xs text-[var(--color-muted)]">{account.organizationId ? "Organization" : "User"}</p>
                  </td>
                  <td className="py-4 pr-4">{account.currencyCode} {Number(account.balanceAmount).toFixed(2)}</td>
                  <td className="py-4 pr-4"><Badge tone={account.status === "active" ? "success" : "neutral"}>{account.status}</Badge></td>
                  <td className="py-4">{account.ledgerEntries[0]?.reason ?? "No ledger entries"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
