import { FulfillmentStatusBadge, FulfillmentTabs, PickupLocationForm } from "@/components/fulfillment/fulfillment-forms";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listSellerPickupLocations } from "@/server/fulfillment/fulfillment-service";
import { getGoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import { saveRestaurantPickupLocationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RestaurantPickupPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Pickup settings are available for restaurant organizations." />;
  }
  const [locations, mapsConfig] = await Promise.all([
    listSellerPickupLocations(session),
    getGoogleMapsPublicConfig(session.activeOrganization.countryCode),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Restaurant" title="Pickup locations" description="Manage customer pickup addresses, instructions, and default handoff details." />
      <FulfillmentTabs basePath="/restaurant/fulfillment" />
      <PickupLocationForm action={saveRestaurantPickupLocationAction} mapsConfig={mapsConfig} />
      <div className="grid gap-4">
        {locations.map((location) => (
          <Card key={location.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-[var(--color-ink)]">{location.label}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{[location.addressLine1, location.city, location.region, location.postalCode].filter(Boolean).join(", ")}</p>
                {location.instructions ? <p className="mt-2 text-sm text-[var(--color-muted)]">{location.instructions}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {location.isDefault ? <FulfillmentStatusBadge status="default" /> : null}
                <FulfillmentStatusBadge status={location.status} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
