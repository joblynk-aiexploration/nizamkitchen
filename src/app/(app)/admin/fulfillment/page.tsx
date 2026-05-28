import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminFulfillmentDashboard } from "@/server/fulfillment/fulfillment-service";

export const dynamic = "force-dynamic";

export default async function AdminFulfillmentPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const dashboard = await getAdminFulfillmentDashboard(session);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Fulfillment operations" description="Monitor pickup, delivery zones, scheduling, and order handoff status across sellers." />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary"><Link href="/admin/fulfillment/orders">Fulfillment orders</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/fulfillment/zones">Delivery zones</Link></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Active orders" value={dashboard.activeOrders} hint="Needs seller/customer action" />
        <MetricCard label="Ready/out" value={dashboard.readyOrders} hint="Pickup or delivery handoff" />
        <MetricCard label="Active zones" value={dashboard.activeZones} hint="Seller delivery areas" />
        <MetricCard label="Pickup points" value={dashboard.pickupLocations} hint="Active pickup locations" />
      </div>
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Operational guardrails</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Delivery fees and zones are seller-configured. NizamKitchen does not infer jurisdiction-specific fees or taxes unless Platform Owner settings define them.
        </p>
      </Card>
    </div>
  );
}
