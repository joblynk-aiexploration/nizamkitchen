import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminFulfillmentZones } from "@/server/fulfillment/fulfillment-service";

export const dynamic = "force-dynamic";

export default async function AdminFulfillmentZonesPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const zones = await listAdminFulfillmentZones(session, params);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Delivery zones" description="Review seller delivery coverage, fees, and service-radius configuration." />
      {zones.length === 0 ? <EmptyState title="No delivery zones" description="Seller-created delivery zones will appear here for operational review." /> : null}
      <div className="grid gap-4">
        {zones.map((zone) => (
          <Card key={zone.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-[var(--color-ink)]">{zone.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {zone.organization.name} · {[zone.city, zone.region, zone.countryCode].filter(Boolean).join(", ")}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Fee {zone.deliveryFeeAmount} · Radius {zone.radiusKm ?? "not set"} km · Minimum {zone.minimumOrderAmount ?? "none"}
                </p>
              </div>
              <Badge tone={zone.status === "active" ? "success" : zone.status === "disabled" ? "warning" : "neutral"}>{zone.status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
