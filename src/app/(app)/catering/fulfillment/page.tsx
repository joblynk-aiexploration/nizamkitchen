import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CateringFulfillmentPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Fulfillment tools are available for home catering organizations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Home catering" title="Fulfillment" description="Pickup, delivery, prep, and packaging workflows for catering orders." />
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Orders can already be accepted, prepared, marked ready, and completed. Dedicated fulfillment batching will be added here later.
        </p>
      </Card>
    </div>
  );
}
