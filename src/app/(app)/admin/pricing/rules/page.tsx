import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listFeePolicies } from "@/server/pricing/fee-policy-service";
import { labelize } from "../pricing-forms";

export const dynamic = "force-dynamic";

export default async function PricingRulesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const policies = await listFeePolicies();
  const rules = policies.flatMap((policy) => policy.rules.map((rule) => ({ policy, rule })));
  return (
    <AdminShell session={session} title="Fee rules" description="Review every fee, tax, discount, payout, and commission rule across active and draft policies.">
      <Card>
        <div className="divide-y divide-[var(--color-border)]">
          {rules.map(({ policy, rule }) => (
            <div key={rule.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{rule.displayName}</p>
                <p className="text-sm text-[var(--color-muted)]">{policy.name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{labelize(rule.feeType)}</Badge>
                <Badge tone={rule.isActive ? "success" : "neutral"}>{rule.isActive ? "Active" : "Disabled"}</Badge>
                <Badge tone="neutral">{rule.currencyCode}</Badge>
              </div>
            </div>
          ))}
          {rules.length === 0 ? <p className="py-4 text-sm text-[var(--color-muted)]">No pricing rules yet.</p> : null}
        </div>
      </Card>
    </AdminShell>
  );
}
