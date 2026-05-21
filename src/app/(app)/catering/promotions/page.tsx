import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CateringPromotionsPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Promotion tools are available for home catering organizations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Home catering" title="Promotions" description="Plan seller promotions, featured dishes, and seasonal menus." />
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Featured menu items are available today. Promotion campaigns will be added once marketplace marketing rules are finalized.
        </p>
      </Card>
    </div>
  );
}
