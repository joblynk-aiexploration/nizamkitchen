import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isChefOrganization, listChefHomeChefRequestsForViewer } from "@/server/home-chef";

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

  const requests = await listChefHomeChefRequestsForViewer({ session });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef workspace"
        title="Orders"
        description="Review household orders assigned to your chef profile. Open an order to see details, chat, accept, or decline."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When a household places an order for your chef profile, it will appear here."
        />
      ) : (
        <div className="space-y-8">
          <RequestSection
            title="Assigned to you"
            description="Orders that belong to your chef profile."
            emptyMessage="No orders are assigned to your chef profile yet."
            requests={requests}
          />
        </div>
      )}
    </div>
  );
}

function RequestSection({
  title,
  description,
  emptyMessage,
  requests,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  requests: Awaited<ReturnType<typeof listChefHomeChefRequestsForViewer>>;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      {requests.length === 0 ? (
        <Card className="text-sm text-[var(--color-muted)]">{emptyMessage}</Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={request.currentOffer?.status === "pending" ? "warning" : "success"}>
                      {request.currentOffer?.status === "pending" ? "Offer pending" : "Assigned to you"}
                    </Badge>
                    <Badge tone="info">{request.requestType.replace(/_/g, " ")}</Badge>
                    <Badge tone="neutral">{request.status}</Badge>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">{request.title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {request.requestedDate.toLocaleDateString()} · {request.guestCount} guests · {request.generalLocation}
                  </p>
                  {request.currentOffer?.status === "pending" ? (
                    <p className="mt-2 text-sm font-semibold text-amber-700">
                      Respond by {request.currentOffer.responseDeadlineAt.toLocaleString()}
                    </p>
                  ) : null}
                </div>
                {request.recipe ? (
                  <div className="flex flex-col gap-2 text-sm font-semibold md:items-end">
                    <Link href={`/chef/requests/${request.id}`} className="text-[var(--color-primary)]">
                      View order
                    </Link>
                    <Link href={`/recipes/${request.recipe.id}`} className="text-[var(--color-muted)]">
                      View recipe
                    </Link>
                  </div>
                ) : (
                  <Link href={`/chef/requests/${request.id}`} className="text-sm font-semibold text-[var(--color-primary)]">
                    View order
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
