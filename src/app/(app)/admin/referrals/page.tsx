import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listReferralCodes } from "@/server/promotions";
import { createReferralCodeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const referrals = await listReferralCodes();
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Referrals" description="Manage referral codes and reward credit settings. Rewards are tracked as credit ledger entries, not fake payments.">
      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Create referral code</h2>
          <form action={createReferralCodeAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput label="Code" name="code" placeholder="FAMILY100" required />
            <TextInput label="Owner user ID" name="ownerUserId" required />
            <TextInput label="Owner organization ID" name="ownerOrganizationId" />
            <TextInput label="Country" name="countryCode" maxLength={2} />
            <TextInput label="City" name="city" />
            <TextInput label="Usage limit" name="usageLimit" type="number" min="1" />
            <TextInput label="Reward credit amount" name="rewardCreditAmount" type="number" min="0" step="0.01" />
            <TextInput label="Reward currency" name="rewardCurrencyCode" defaultValue="USD" maxLength={3} />
            <div className="md:col-span-2"><Button type="submit">Create referral code</Button></div>
          </form>
        </Card>
      ) : null}

      {referrals.length === 0 ? <EmptyState title="No referral codes" description="Referral codes will appear here after creation." /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="py-3 pr-4">Code</th>
                <th className="py-3 pr-4">Owner</th>
                <th className="py-3 pr-4">Usage</th>
                <th className="py-3 pr-4">Reward</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr key={referral.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4 font-semibold text-[var(--color-ink)]">{referral.code}</td>
                  <td className="py-4 pr-4">{referral.ownerOrganizationId ?? referral.ownerUserId}</td>
                  <td className="py-4 pr-4">{referral.usageCount}{referral.usageLimit ? ` / ${referral.usageLimit}` : ""}</td>
                  <td className="py-4 pr-4">{referral.rewardCurrencyCode ?? ""} {referral.rewardCreditAmount ? Number(referral.rewardCreditAmount).toFixed(2) : "0.00"}</td>
                  <td className="py-4"><Badge tone={referral.status === "active" ? "success" : "neutral"}>{referral.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
