import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, ExternalLink, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <BookmarkCheck className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--color-ink)] truncate">{r.name}</p>
                  {r.category && (
                    <p className="text-xs text-[var(--color-muted)] capitalize mt-0.5">{r.category}</p>
                  )}
                </div>
              </div>

              {r.address && (
                <div className="flex items-start gap-1.5 text-sm text-[var(--color-muted)]">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{r.address}</span>
                </div>
              )}

              {r.notes && (
                <p className="text-xs text-[var(--color-muted)] border-t border-[var(--color-border)] pt-2">
                  {r.notes}
                </p>
              )}

              {r.mapUrl && (
                <a
                  href={r.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  View on map <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <p className="text-xs text-[var(--color-muted)]">
                Added {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
