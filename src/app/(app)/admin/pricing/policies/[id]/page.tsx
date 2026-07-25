import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { getFeePolicy } from "@/server/pricing/fee-policy-service";
import { FeePolicyForm, FeeRuleForm, labelize } from "../../pricing-forms";

export const dynamic = "force-dynamic";

export default async function PricingPolicyDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const policy = await getFeePolicy(id);
  if (!policy) notFound();

  return (
    <AdminShell session={session} title={policy.name} description="Edit the fee policy and attach pricing rules.">
      <FormMessage message={query.message} />
      <Card>
        <FeePolicyForm policy={policy} />
      </Card>
      <FeeRuleForm policyId={policy.id} />
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Rules</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {policy.rules.map((rule) => (
            <div key={rule.id} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--color-ink)]">{rule.displayName}</p>
                  <Badge tone={rule.isActive ? "success" : "neutral"}>{rule.isActive ? "Active" : "Disabled"}</Badge>
                  <Badge tone="info">{labelize(rule.feeType)}</Badge>
                  <Badge tone="neutral">{labelize(rule.calculationType)}</Badge>
                </div>
                <p className="mt-1 text-[var(--color-muted)]">
                  Percent {rule.percentage?.toString() ?? "-"} · Fixed {rule.fixedAmount?.toString() ?? "-"} · Min {rule.minAmount?.toString() ?? "-"} · Max {rule.maxAmount?.toString() ?? "-"} · Threshold {rule.thresholdAmount?.toString() ?? "-"}
                </p>
              </div>
              <p className="font-semibold text-[var(--color-ink)]">{rule.currencyCode}</p>
            </div>
          ))}
          {policy.rules.length === 0 ? <p className="py-4 text-sm text-[var(--color-muted)]">No rules added yet.</p> : null}
        </div>
      </Card>
    </AdminShell>
  );
}
