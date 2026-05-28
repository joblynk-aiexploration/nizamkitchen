import Link from "next/link";
import { redirect } from "next/navigation";
import { BookmarkCheck } from "lucide-react";
import { PlaceResultCard } from "@/components/maps/PlaceResultCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listSavedRestaurants } from "@/server/restaurants/restaurant-fallback-service";

export const dynamic = "force-dynamic";

export default async function SavedRestaurantsPage() {
  const session = await requireMembership();
  const orgId = session.activeOrganization.id;
  const enabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!enabled) redirect("/order-instead");

  const saved = await listSavedRestaurants(orgId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order Instead"
        title="Saved restaurants"
        description="Restaurants your organization has bookmarked."
        actions={
          <Button asChild variant="secondary">
            <Link href="/order-instead/search">New search</Link>
          </Button>
        }
      />

      {saved.length === 0 ? (
        <EmptyState
          title="No saved restaurants"
          description="Search for restaurants and bookmark the ones you like."
          action={
            <Button asChild>
              <Link href="/order-instead/search">Search now</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((r) => (
            <PlaceResultCard
              key={r.id}
              name={r.name}
              address={r.address}
              category={r.category}
              mapUrl={r.mapUrl}
              rating={r.rating}
              ratingCount={r.ratingCount}
              priceLevel={r.priceLevel}
              openNow={r.openNow}
              footer={(
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs text-green-700">
                    <BookmarkCheck className="h-4 w-4" />
                    Saved by your organization
                  </div>
                  {r.notes ? <p className="text-xs text-[var(--color-muted)]">{r.notes}</p> : null}
                  <p className="text-xs text-[var(--color-muted)]">
                    Added {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
