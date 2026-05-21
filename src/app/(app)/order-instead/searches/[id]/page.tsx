import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getGoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import { getSearchWithResults } from "@/server/restaurants/restaurant-fallback-service";
import { SearchResultsClient } from "./search-results-client";

export const dynamic = "force-dynamic";

const statusTone = {
  pending: "neutral",
  completed: "success",
  failed: "warning",
} as const;

export default async function SearchResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const orgId = session.activeOrganization.id;
  const enabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!enabled) redirect("/order-instead");

  const { id } = await params;
  const [search, mapsConfig] = await Promise.all([
    getSearchWithResults(id, orgId),
    getGoogleMapsPublicConfig(session.activeOrganization.countryCode),
  ]);
  if (!search) notFound();

  const tone = statusTone[search.status as keyof typeof statusTone] ?? "neutral";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/order-instead/searches" className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          eyebrow="Order Instead"
          title={search.query}
          description={[search.city, search.region].filter(Boolean).join(", ") || "No location specified"}
          actions={<Badge tone={tone}>{search.status}</Badge>}
        />
      </div>

      {search.status === "failed" && search.errorMessage && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{search.errorMessage}</p>
        </Card>
      )}

      {search.status === "pending" && (
        <Card className="p-4">
          <p className="text-sm text-[var(--color-muted)]">Search is still running. Refresh the page in a moment.</p>
        </Card>
      )}

      {search.results.length > 0 ? (
        <SearchResultsClient
          results={search.results}
          browserApiKey={mapsConfig.enabled ? mapsConfig.browserApiKey : null}
        />
      ) : search.status === "completed" ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">No restaurants found for this search. Try a different query or city.</p>
        </Card>
      ) : null}

      <div className="text-xs text-[var(--color-muted)]">
        Results sourced from Google Places. Ratings, price levels, and open-now labels appear only when Google returns them.
      </div>
    </div>
  );
}
