import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listSellerFoodOrders } from "@/server/food-orders";
import { getSellerUsage, isMetricAtLimit, isMetricUnlimited } from "@/server/billing/seller-usage";
import { UpgradeModal } from "@/components/commerce/upgrade-modal";

export const dynamic = "force-dynamic";

export default async function CateringOrdersPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Seller order requests are available to home catering organizations." />;
  }

  const [orders, usage] = await Promise.all([
    listSellerFoodOrders(session.activeOrganization.id),
    getSellerUsage(session.activeOrganization.id),
  ]);

  const orderMetric = usage.metrics.find((m) => m.key === "orders");
  const showOrderUsage = orderMetric && !isMetricUnlimited(orderMetric);
  const atOrderLimit = orderMetric ? isMetricAtLimit(orderMetric) : false;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering" title="Order requests" description="Review food order requests from households, including payment status and fulfillment." />

      {showOrderUsage && orderMetric && (
        <OrderUsageBanner
          metric={orderMetric}
          atLimit={atOrderLimit}
          planName={usage.entitlement.planName}
          upgradePlans={usage.upgradePlans}
        />
      )}

      {orders.length === 0 ? <EmptyState title="No orders yet" description="Published menu items will let households submit order inquiries here." /> : null}
      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <h2 className="font-semibold text-[var(--color-ink)]">{order.customerOrganization.name}</h2>
                  <Badge tone="info">{order.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{order.items.map((item) => `${item.quantity} x ${item.nameSnapshot}`).join(", ")}</p>
              </div>
              <Button asChild variant="secondary"><Link href={`/catering/orders/${order.id}`}>Manage</Link></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrderUsageBanner({
  metric,
  atLimit,
  planName,
  upgradePlans,
}: {
  metric: { label: string; current: number; limit: number };
  atLimit: boolean;
  planName: string;
  upgradePlans: Array<{ slug: string; name: string; tier: string; billingInterval: "monthly" | "yearly" | "custom"; priceAmount: number; featuresJson: string[] }>;
}) {
  const pct = Math.min(100, Math.round((metric.current / metric.limit) * 100));
  const nearLimit = !atLimit && pct >= 80;
  const remaining = Math.max(0, metric.limit - metric.current);
  const barColor = atLimit ? "bg-[var(--color-danger)]" : nearLimit ? "bg-amber-500" : "bg-[var(--color-primary)]";

  return (
    <Card className={atLimit ? "border-red-200 bg-red-50/60" : nearLimit ? "border-amber-200 bg-amber-50/60" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Orders this month</p>
          <p className={`text-2xl font-bold ${atLimit ? "text-[var(--color-danger)]" : nearLimit ? "text-amber-600" : "text-[var(--color-ink)]"}`}>
            {metric.current} <span className="text-sm font-normal text-[var(--color-muted)]">/ {metric.limit}</span>
          </p>
        </div>
        {(atLimit || nearLimit) && upgradePlans.length > 0 && (
          <UpgradeModal
            trigger={<Button variant={atLimit ? "warning" : "secondary"}>Upgrade plan</Button>}
            currentPlanName={planName}
            limitLabel="Orders"
            current={metric.current}
            limit={metric.limit}
            upgradePlans={upgradePlans}
          />
        )}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-2 text-xs ${atLimit ? "font-medium text-[var(--color-danger)]" : nearLimit ? "text-amber-600" : "text-[var(--color-muted)]"}`}>
        {atLimit
          ? "None remaining — upgrade to accept more orders."
          : nearLimit
          ? `${remaining} remaining — consider upgrading your plan.`
          : `${remaining} remaining`}
      </p>
    </Card>
  );
}
