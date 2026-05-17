import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await requireMembership();
  const subscriptions = await prisma.billingSubscription.findMany({
    where: { organizationId: session.activeOrganization.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Commercial foundation"
        title="Billing"
        description="Subscriptions are modeled now so future paid modules can plug into a tenant-safe billing lifecycle later."
      />
      <div className="grid gap-4">
        {subscriptions.length === 0 ? (
          <Card>
            <h2 className="text-xl font-semibold">No billing plan connected yet</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Billing integration is intentionally a placeholder in this phase. The schema and route structure are ready for future subscription management.
            </p>
          </Card>
        ) : (
          subscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{subscription.planCode}</h2>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {subscription.provider} • {subscription.currencyCode} • {subscription.billingPeriod}
                  </p>
                </div>
                <StatusBadge value={subscription.status} />
              </div>
              <p className="mt-4 text-sm text-[var(--color-muted)]">
                Current period ends: {formatDate(subscription.currentPeriodEnd)}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
