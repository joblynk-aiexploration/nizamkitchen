import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listSearches } from "@/server/restaurants/restaurant-fallback-service";

export const dynamic = "force-dynamic";

const statusTone = {
  pending: "neutral",
  completed: "success",
  failed: "warning",
} as const;

export default async function SearchHistoryPage() {
  const session = await requireMembership();
  const orgId = session.activeOrganization.id;
  const enabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!enabled) redirect("/order-instead");

  const searches = await listSearches(orgId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order Instead"
        title="Search history"
        description="Your organization's recent restaurant searches."
      />

      {searches.length === 0 ? (
        <EmptyState
          title="No searches yet"
          description="Run a search from the Order Instead page to get started."
          action={
            <Button asChild>
              <Link href="/order-instead/search">Search now</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {searches.map((s) => (
            <Link key={s.id} href={`/order-instead/searches/${s.id}`}>
              <Card className="p-4 hover:border-[var(--color-primary)] transition cursor-pointer">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-ink)] truncate">{s.query}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {s.city ? `${s.city} · ` : ""}
                      {new Date(s.createdAt).toLocaleDateString()}
                      {s._count.results > 0 ? ` · ${s._count.results} results` : ""}
                    </p>
                  </div>
                  <Badge tone={statusTone[s.status as keyof typeof statusTone] ?? "neutral"}>
                    {s.status}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
