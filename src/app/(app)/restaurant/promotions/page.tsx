import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RestaurantPromotionsPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Promotion tools are available for restaurant organizations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Restaurant" title="Promotions" description="Plan featured items, seasonal menus, and restaurant promotions." />
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Featured menu items are available today. Promotion campaigns will be added once marketplace marketing rules are finalized.
        </p>
      </Card>
    </div>
  );
}
