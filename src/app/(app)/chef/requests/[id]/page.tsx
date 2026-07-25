import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { TextArea } from "@/components/ui/text-area";
import { requireMembership } from "@/lib/auth/session";
import { getHomeChefRequestForViewer, isChefOrganization } from "@/server/home-chef";
import { acceptChefOrderAction, createChefOrderMessageAction, declineChefOrderAction } from "../../actions";

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

export default async function ChefOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const query = await searchParams;

  if (!isChefOrganization(session.activeOrganization.organizationType)) {
    return (
      <EmptyState
        title="Chef organization required"
        description="Orders are visible only to the chef profile they are assigned to."
      />
    );
  }

  const request = await getHomeChefRequestForViewer({ session, requestId: id }).catch(() => null);
  if (!request) notFound();

  const pendingOffer = request.currentOffer?.status === "pending" ? request.currentOffer : null;
  const canRespond = Boolean(pendingOffer) || !["accepted", "declined", "cancelled", "completed"].includes(request.status);
  const isLogisticsVisible = request.visibilityStage === "chef_logistics";
  const regionLabel = request.countryCode === "US" ? "State" : "Region";
  const postalLabel = request.countryCode === "US" ? "Zip code" : "Postal code";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef order"
        title={request.title}
        description={`${request.requestType.replace(/_/g, " ")} · ${request.requestedDate.toLocaleDateString()} · ${request.guestCount} guests`}
        actions={
          <Button asChild variant="secondary">
            <Link href="/chef/requests">Back to orders</Link>
          </Button>
        }
      />

      <FormMessage message={query.message} />

      <div className="flex flex-wrap gap-2">
        <Badge tone={statusTone[request.status]}>{request.status}</Badge>
        <Badge tone="info">{request.countryCode}</Badge>
        <Badge tone={pendingOffer ? "warning" : "success"}>
          {pendingOffer ? "Offer pending" : isLogisticsVisible ? "Booking confirmed" : "Limited details"}
        </Badge>
        {pendingOffer ? <Badge tone="neutral">Deadline {pendingOffer.responseDeadlineAt.toLocaleString()}</Badge> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">
              {isLogisticsVisible ? "Booking confirmed" : "Limited request details"}
            </h2>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {request.communicationWarning}
            </div>
            {request.description ? (
              <p className="text-sm leading-6 text-[var(--color-muted)]">{request.description}</p>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No description was added.</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Food requested" value={request.recipe?.name ?? request.title} />
              <Info label="Customer" value={request.customerDisplayName} />
              <Info label="Service area" value={request.generalLocation} />
              <Info label="Requested date" value={request.requestedDate.toLocaleDateString()} />
              <Info label="Time window" value={request.requestedTimeWindow} />
              <Info label="Guests" value={request.guestCount.toString()} />
              <Info label="Household size" value={request.householdSize?.toString()} />
              <Info label="Preferred language" value={request.preferredLanguage} />
              <Info label="Budget" value={request.budgetAmount ? `${request.budgetAmount} ${request.budgetCurrency}` : null} />
              <Info label="Gender preference" value={request.genderPreference.replace(/_/g, " ")} />
            </div>
            {isLogisticsVisible ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Arrival logistics</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Info label="Street address" value={request.address.exactAddressLine1} />
                  <Info label="Unit / access line" value={request.address.exactAddressLine2} />
                  <Info label="City" value={request.address.city} />
                  <Info label={regionLabel} value={request.address.region} />
                  <Info label={postalLabel} value={request.address.postalCode} />
                  <Info label="Proxy contact" value={request.contactProxy.proxyNumber ?? "Use in-app messaging"} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
                Exact address, phone, and email are hidden until you accept the request. Before acceptance, only the city is shown.
              </div>
            )}
            {request.notes ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Household notes</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{request.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Planning context</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {request.recipe ? (
                <Link href={`/recipes/${request.recipe.id}`} className="rounded-2xl border border-[var(--color-border)] p-4 hover:bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recipe</p>
                  <p className="mt-2 font-semibold text-[var(--color-ink)]">{request.recipe.name}</p>
                </Link>
              ) : null}
              {request.mealPlan ? (
                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meal plan</p>
                  <p className="mt-2 font-semibold text-[var(--color-ink)]">{request.mealPlan.name}</p>
                </div>
              ) : null}
              {!request.recipe && !request.mealPlan ? (
                <p className="text-sm text-[var(--color-muted)]">No recipe or meal plan is linked to this order.</p>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-5">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Chat</h2>
            <div className="space-y-3">
              {request.messages.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No messages yet.</p>
              ) : (
                request.messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--color-ink)]">{message.senderDisplayName}</p>
                      <Badge tone={message.senderRole === "chef" ? "success" : "info"}>{message.senderRole}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{message.message}</p>
                  </div>
                ))
              )}
            </div>
            <form action={createChefOrderMessageAction} className="space-y-3">
              <input type="hidden" name="requestId" value={request.id} />
              <TextArea label="Message the household" name="message" required />
              <Button type="submit">Send message</Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          {canRespond ? (
            <Card className="space-y-4 border-emerald-200 bg-emerald-50">
              <h2 className="font-semibold text-emerald-950">{pendingOffer ? "Respond to offer" : "Respond to order"}</h2>
              <p className="text-sm text-emerald-800">
                Accept if you can cook in the household kitchen for this request, or decline quickly so the platform can offer the job to another verified chef.
              </p>
              <form action={acceptChefOrderAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <TextArea label="Acceptance note" name="note" defaultValue="Accepted by chef." />
                <Button type="submit" className="w-full">Accept order</Button>
              </form>
              <form action={declineChefOrderAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <TextArea label="Decline reason" name="note" defaultValue="Declined by chef." />
                <Button type="submit" variant="danger" className="w-full">Decline order</Button>
              </form>
            </Card>
          ) : null}

          <Card className="space-y-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Status timeline</h2>
            <div className="space-y-3">
              {request.statusHistory.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <Badge tone={statusTone[item.newStatus]}>{item.newStatus}</Badge>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {item.createdAt.toLocaleString()} by {item.changedBy.fullName}
                  </p>
                  {item.note ? <p className="mt-2 text-sm text-[var(--color-muted)]">{item.note}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{value || "Not provided"}</p>
    </div>
  );
}
