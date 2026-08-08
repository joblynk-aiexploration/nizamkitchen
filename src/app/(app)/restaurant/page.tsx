import { Store } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getSellerDashboardVerificationSummary } from "@/server/seller-verification-gates";
import { PlanUsagePanel } from "@/components/commerce/plan-usage-panel";

export const dynamic = "force-dynamic";

export default async function RestaurantDashboardPage() {
  const session = await requireMembership();

  if (session.activeOrganization.organizationType !== "restaurant") {
    return (
      <EmptyState
        title="Restaurant workspace only"
        description="This placeholder dashboard is shown only for restaurant organizations. Use Order Instead to search restaurants as a household."
      />
    );
  }
  const gateSummary = await getSellerDashboardVerificationSummary({
    organizationId: session.activeOrganization.id,
    sellerType: "restaurant",
    countryCode: session.activeOrganization.countryCode,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Restaurant workspace"
        title={session.activeOrganization.name}
        description="Manage restaurant profile foundations and menus households can browse before live ordering is connected."
      />
      <PlanUsagePanel organizationId={session.activeOrganization.id} />
      <VerificationGateAlert summary={gateSummary} />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <Store className="h-6 w-6 text-[var(--color-primary)]" />
          <h2 className="mt-4 font-semibold text-[var(--color-ink)]">Profile placeholder</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Public restaurant listings and lead management are not enabled yet.</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Menus</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Create restaurant menus and dishes for household browsing.</p>
          <Button asChild variant="secondary" className="mt-5"><Link href="/restaurant/menu">Manage menus</Link></Button>
        </Card>
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Ordering</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Review incoming order requests. Customers can pay securely through hosted checkout.</p>
          <Button asChild variant="secondary" className="mt-5"><Link href="/restaurant/orders">View orders</Link></Button>
        </Card>
      </section>
    </div>
  );
}

function VerificationGateAlert({ summary }: { summary: { missingRequirements: string[]; blockedCapabilities: string[]; policyName: string | null; overrideActive: boolean } }) {
  if (summary.missingRequirements.length === 0 && summary.blockedCapabilities.length === 0) return null;
  return (
    <Card className="border-amber-200 bg-amber-50">
      <h2 className="font-semibold text-amber-950">Verification checklist</h2>
      <p className="mt-2 text-sm text-amber-900">Policy: {summary.policyName ?? "No active marketplace gate policy"}. {summary.overrideActive ? "A temporary admin override is active." : "Complete the next steps to unlock marketplace capabilities."}</p>
      {summary.blockedCapabilities.length ? <p className="mt-3 text-sm text-amber-900">Blocked: {summary.blockedCapabilities.map((item) => item.replace(/_/g, " ")).join(", ")}.</p> : null}
      {summary.missingRequirements.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">{summary.missingRequirements.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <Button asChild variant="secondary" className="mt-4"><Link href="/restaurant/verification">Open verification</Link></Button>
    </Card>
  );
}
