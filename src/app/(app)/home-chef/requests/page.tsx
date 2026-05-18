import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessHomeChefs, isHouseholdRequestOrganization, listHomeChefRequests } from "@/server/home-chef";

export const dynamic = "force-dynamic";

const statusTone = {
  draft: "neutral",
  submitted: "warning",
  reviewing: "warning",
  matched: "info",
  quoted: "info",
  accepted: "success",
  declined: "danger",
  cancelled: "neutral",
  completed: "success",
} as const;

export default async function HomeChefRequestsPage() {
  const session = await requireMembership();
  const enabled = await canAccessHomeChefs({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled || !isHouseholdRequestOrganization(session.activeOrganization.organizationType)) {
    return (
      <EmptyState
        title="Home chef requests unavailable"
        description="This manual request flow is available only for enabled household organizations."
      />
    );
  }

  const requests = await listHomeChefRequests(session.activeOrganization.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home chef"
        title="Your requests"
        description="Track draft, submitted, matched, and completed manual chef requests for your household."
        actions={
          <Button asChild>
            <Link href="/home-chef/request">New request</Link>
          </Button>
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No home chef requests"
          description="Create a request from a recipe, meal plan, occasion, or custom cooking need."
          action={
            <Button asChild>
              <Link href="/home-chef/request">Create request</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Link key={request.id} href={`/home-chef/requests/${request.id}`}>
              <Card className="transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone[request.status]}>{request.status}</Badge>
                      <Badge tone="info">{request.requestType.replace(/_/g, " ")}</Badge>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">{request.title}</h2>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      {request.requestedDate.toLocaleDateString()} · {request.guestCount} guests
                      {request.recipe ? ` · ${request.recipe.name}` : ""}
                      {request.mealPlan ? ` · ${request.mealPlan.name}` : ""}
                    </p>
                  </div>
                  <div className="text-sm text-[var(--color-muted)]">
                    {request._count.messages} messages · {request._count.statusHistory} updates
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
