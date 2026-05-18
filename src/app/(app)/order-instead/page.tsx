import Link from "next/link";
import { UtensilsCrossed, Search, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function OrderInsteadPage() {
  const session = await requireMembership();
  const orgId = session.activeOrganization.id;
  const enabled = await isFeatureEnabled("restaurant_fallback", orgId);

  if (!enabled) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Order Instead"
          title="Find a restaurant near you"
          description="Not cooking tonight? Search for local restaurants that serve the dishes you love."
        />
        <Card>
          <div className="space-y-4 py-14 text-center">
            <UtensilsCrossed className="mx-auto h-12 w-12 text-[var(--color-muted)]" />
            <p className="text-xl font-semibold text-[var(--color-ink)]">Coming soon</p>
            <p className="mx-auto max-w-md text-sm text-[var(--color-muted)]">
              Restaurant discovery is not yet enabled for your organization.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order Instead"
        title="Find a restaurant near you"
        description="Search for local restaurants serving the dishes you love. Results come from MapTiler's place index."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Search className="h-6 w-6 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-ink)]">Search restaurants</h2>
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            Enter a dish or cuisine to find restaurants near you.
          </p>
          <Button asChild>
            <Link href="/order-instead/search">Start searching</Link>
          </Button>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <BookmarkCheck className="h-6 w-6 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-ink)]">Saved restaurants</h2>
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            View places your organization has bookmarked.
          </p>
          <Button variant="secondary" asChild>
            <Link href="/saved-restaurants">View saved</Link>
          </Button>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Recent searches</h2>
          <Link href="/order-instead/searches" className="text-xs text-[var(--color-primary)] hover:underline">
            View all
          </Link>
        </div>
        <p className="text-sm text-[var(--color-muted)]">Your search history appears here after you run a search.</p>
      </div>
    </div>
  );
}
