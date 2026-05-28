import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RestaurantSettingsPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Restaurant settings are available only for restaurant organizations." />;
  }
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title="Restaurant settings" description="Manage restaurant workspace settings and profile links." />
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Profile and links</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Use the restaurant profile page to manage public social links and marketplace basics.</p>
        <Button asChild variant="secondary" className="mt-5"><Link href="/restaurant/profile">Open profile</Link></Button>
      </Card>
    </div>
  );
}
