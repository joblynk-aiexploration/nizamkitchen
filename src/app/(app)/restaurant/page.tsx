import { Store } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";

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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Restaurant workspace"
        title={session.activeOrganization.name}
        description="Manage restaurant profile foundations and menus households can browse before live ordering is connected."
      />

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
          <p className="mt-2 text-sm text-[var(--color-muted)]">Review manual order requests. No checkout or payment processing is connected.</p>
          <Button asChild variant="secondary" className="mt-5"><Link href="/restaurant/orders">View orders</Link></Button>
        </Card>
      </section>
    </div>
  );
}
