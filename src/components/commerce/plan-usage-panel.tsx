import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSellerUsage, isMetricAtLimit, isMetricUnlimited, type UsageMetric, type UpgradePlanOption } from "@/server/billing/seller-usage";
import { UpgradeModal } from "./upgrade-modal";

export async function PlanUsagePanel({ organizationId }: { organizationId: string }) {
  const { entitlement, metrics, upgradePlans } = await getSellerUsage(organizationId);

  const hasFiniteLimits = metrics.some((m) => !isMetricUnlimited(m));
  if (!hasFiniteLimits) return null;

  const firstAtLimit = metrics.find(isMetricAtLimit);
  const firstNearLimit = !firstAtLimit
    ? metrics.find(
        (m) => !isMetricAtLimit(m) && !isMetricUnlimited(m) && Math.round((m.current / m.limit) * 100) >= 80,
      )
    : undefined;
  const upgradeTarget = firstAtLimit ?? firstNearLimit ?? null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current plan</p>
          <p className="mt-1 font-semibold text-[var(--color-ink)]">{entitlement.planName}</p>
          <p className="mt-0.5 text-xs capitalize text-[var(--color-muted)]">{entitlement.planTier} tier</p>
        </div>
        {upgradeTarget && upgradePlans.length > 0 ? (
          <UpgradeModal
            trigger={
              <Button variant={firstAtLimit ? "warning" : "secondary"} className="shrink-0">
                Upgrade plan
              </Button>
            }
            currentPlanName={entitlement.planName}
            limitLabel={upgradeTarget.label}
            current={upgradeTarget.current}
            limit={upgradeTarget.limit}
            upgradePlans={upgradePlans}
          />
        ) : (
          <Button asChild variant="outline">
            <Link href="/billing/plans">View plans</Link>
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <UsageBar
            key={metric.key}
            metric={metric}
            upgradePlans={upgradePlans}
            planName={entitlement.planName}
          />
        ))}
      </div>
    </Card>
  );
}

function UsageBar({
  metric,
  upgradePlans,
  planName,
}: {
  metric: UsageMetric;
  upgradePlans: UpgradePlanOption[];
  planName: string;
}) {
  const unlimited = isMetricUnlimited(metric);
  const pct = unlimited ? 0 : Math.min(100, Math.round((metric.current / metric.limit) * 100));
  const atLimit = isMetricAtLimit(metric);
  const nearLimit = !atLimit && pct >= 80;

  const barColor = atLimit
    ? "bg-[var(--color-danger)]"
    : nearLimit
      ? "bg-amber-500"
      : "bg-[var(--color-primary)]";

  const countColor = atLimit
    ? "text-[var(--color-danger)]"
    : nearLimit
      ? "text-amber-600"
      : "text-[var(--color-ink)]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{metric.label}</span>
        {atLimit && upgradePlans.length > 0 && (
          <UpgradeModal
            trigger={
              <span className="cursor-pointer text-xs font-semibold text-[var(--color-danger)] underline underline-offset-2">
                At limit
              </span>
            }
            currentPlanName={planName}
            limitLabel={metric.label}
            current={metric.current}
            limit={metric.limit}
            upgradePlans={upgradePlans}
          />
        )}
      </div>

      <p className={`text-2xl font-bold ${countColor}`}>
        {metric.current}
        {!unlimited && (
          <span className="text-sm font-normal text-[var(--color-muted)]"> / {metric.limit}</span>
        )}
      </p>

      {unlimited ? (
        <p className="text-xs text-[var(--color-muted)]">Unlimited</p>
      ) : (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={`text-xs ${atLimit ? "font-medium text-[var(--color-danger)]" : nearLimit ? "text-amber-600" : "text-[var(--color-muted)]"}`}
          >
            {atLimit ? "None remaining" : `${Math.max(0, metric.limit - metric.current)} remaining`}
          </p>
        </>
      )}
    </div>
  );
}
