import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessHomeCatering, isHomeCateringBusiness } from "@/server/home-catering";

export const dynamic = "force-dynamic";

export default async function CateringSettingsPage() {
  const session = await requireMembership();
  const enabled = await canAccessHomeCatering({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled || !isHomeCateringBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Home catering unavailable" description="Settings are available only for enabled home catering organizations." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home catering"
        title="Seller settings"
        description="Menu management, order requests, and seller policies will live here as the catering module grows."
      />
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Menu management</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Menu items are placeholder-only in this release.</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Order requests</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Order request management is planned later. No live payments are connected.</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Privacy</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Exact home addresses are not displayed publicly in this foundation.</p>
        </Card>
      </div>
    </div>
  );
}
