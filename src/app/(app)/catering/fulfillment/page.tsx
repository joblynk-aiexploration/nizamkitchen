import { FulfillmentTabs, FulfillmentStatusBadge } from "@/components/fulfillment/fulfillment-forms";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getSellerFulfillmentDashboard } from "@/server/fulfillment/fulfillment-service";

export const dynamic = "force-dynamic";

export default async function CateringFulfillmentPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Fulfillment tools are available for home catering organizations." />;
  }

  const dashboard = await getSellerFulfillmentDashboard(session);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Home catering" title="Fulfillment" description="Pickup, delivery, prep, and packaging workflows for catering orders." />
      <FulfillmentTabs basePath="/catering/fulfillment" />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Active orders" value={dashboard.activeOrders} hint="Submitted through delivery" />
        <MetricCard label="Ready/out" value={dashboard.readyOrders} hint="Needs handoff" />
        <MetricCard label="Pickup locations" value={dashboard.pickupLocations.length} hint="Configured addresses" />
        <MetricCard label="Delivery zones" value={dashboard.deliveryZones.length} hint="Service areas" />
      </div>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Fulfillment setup</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold">Pickup</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{dashboard.pickupLocations.length} configured locations</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Delivery</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{dashboard.deliveryZones.filter((zone) => zone.status === "active").length} active zones</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Scheduling</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{dashboard.timeSlots.length} pickup/delivery windows</p>
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Recent configuration</h2>
        <div className="mt-4 grid gap-3">
          {dashboard.pickupLocations.slice(0, 3).map((location) => (
            <div key={location.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] p-3">
              <span>{location.label}</span>
              <FulfillmentStatusBadge status={location.status} />
            </div>
          ))}
          {dashboard.pickupLocations.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Add a pickup location to show pickup instructions on orders.</p> : null}
        </div>
      </Card>
    </div>
  );
}
