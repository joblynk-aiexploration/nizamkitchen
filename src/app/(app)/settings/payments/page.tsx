import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createStripeConnectOnboardingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SellerPaymentSettingsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const params = await searchParams;
  if (!["home_catering", "restaurant", "chef_business"].includes(session.activeOrganization.organizationType)) {
    return <EmptyState title="Seller payments unavailable" description="Payout setup is available only for home catering, restaurant, and chef business organizations." />;
  }
  const payoutAccount = await prisma.sellerPayoutAccount.findUnique({
    where: { organizationId_provider: { organizationId: session.activeOrganization.id, provider: "stripe" } },
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Seller payments" title="Stripe payout setup" description="Set up Stripe Connect so NizamKitchen can route marketplace payments and platform commission safely." />
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Payout account</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Status: <Badge tone={payoutAccount?.status === "active" ? "success" : "warning"}>{payoutAccount?.status ?? "not_started"}</Badge></p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Charges enabled: {payoutAccount?.chargesEnabled ? "yes" : "no"} · Payouts enabled: {payoutAccount?.payoutsEnabled ? "yes" : "no"}</p>
          </div>
          <form action={createStripeConnectOnboardingAction}>
            <Button type="submit">{payoutAccount ? "Refresh payout setup" : "Set up payouts"}</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
