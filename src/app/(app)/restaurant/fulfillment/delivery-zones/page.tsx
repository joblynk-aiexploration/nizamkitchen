import { DeliveryZoneForm, FulfillmentStatusBadge, FulfillmentTabs } from "@/components/fulfillment/fulfillment-forms";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listSellerDeliveryZones } from "@/server/fulfillment/fulfillment-service";
import { saveRestaurantDeliveryZoneAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RestaurantDeliveryZonesPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Delivery zones are available for restaurant organizations." />;
  }
  const zones = await listSellerDeliveryZones(session);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Restaurant" title="Delivery zones" description="Control delivery coverage, fees, radius, and minimum order rules." />
      <FulfillmentTabs basePath="/restaurant/fulfillment" />
      <DeliveryZoneForm action={saveRestaurantDeliveryZoneAction} />
      <div className="grid gap-4">
        {zones.map((zone) => (
          <Card key={zone.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-[var(--color-ink)]">{zone.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {[zone.city, zone.region, zone.radiusKm ? `${zone.radiusKm} km radius` : null].filter(Boolean).join(" · ") || "Postal/radius rules configured"}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Fee: {zone.deliveryFeeAmount} · Minimum: {zone.minimumOrderAmount ?? "none"} · ETA: {zone.estimatedMinutes ?? "not set"} min</p>
              </div>
              <FulfillmentStatusBadge status={zone.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
