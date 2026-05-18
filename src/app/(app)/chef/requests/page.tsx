import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isChefOrganization, listAssignedChefRequests } from "@/server/home-chef";

export const dynamic = "force-dynamic";

export default async function ChefRequestsPage() {
  const session = await requireMembership();

  if (!isChefOrganization(session.activeOrganization.organizationType)) {
    return (
      <EmptyState
        title="Chef organization required"
        description="Assigned home-chef requests are visible only to chef business organizations."
      />
    );
  }

  const requests = await listAssignedChefRequests(session.activeOrganization.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef workspace"
        title="Assigned requests"
        description="Placeholder view for requests assigned by platform admins. Chef self-claiming is intentionally not built yet."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No assigned requests"
          description="Platform support has not assigned any home-chef requests to this chef organization yet."
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{request.requestType.replace(/_/g, " ")}</Badge>
                    <Badge tone="neutral">{request.status}</Badge>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">{request.title}</h2>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {request.requestedDate.toLocaleDateString()} · {request.guestCount} guests · {request.countryCode}
                  </p>
                </div>
                {request.recipe ? (
                  <Link href={`/recipes/${request.recipe.id}`} className="text-sm font-semibold text-[var(--color-primary)]">
                    View recipe
                  </Link>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
