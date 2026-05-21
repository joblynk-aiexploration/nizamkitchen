import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RestaurantFulfillmentPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Fulfillment tools are available for restaurant organizations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Restaurant" title="Fulfillment" description="Pickup, delivery, and order preparation workflows for restaurant orders." />
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Restaurant orders can already move through status management. Dedicated fulfillment operations will be added here later.
        </p>
      </Card>
    </div>
  );
}
