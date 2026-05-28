import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewCreateForm } from "@/components/reviews/review-components";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { canAccessHomeChefs, getHomeChefRequest, isHouseholdRequestOrganization } from "@/server/home-chef";
import { getCustomerHomeChefRequestReview } from "@/server/trust/review-service";
import { cancelHomeChefRequestAction, createHomeChefCheckoutAction, createHomeChefMessageAction, createHomeChefReviewAction, createPayPalHomeChefCheckoutAction } from "../../actions";

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

export default async function HomeChefRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
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

  const request = await getHomeChefRequest(id, session.activeOrganization.id).catch(() => null);
  if (!request) notFound();
  const review = await getCustomerHomeChefRequestReview(request.id, session.activeOrganization.id, session.user.id);

  const canCancel = !["cancelled", "completed"].includes(request.status);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home chef request"
        title={request.title}
        description={`${request.requestType.replace(/_/g, " ")} · ${request.requestedDate.toLocaleDateString()} · ${request.guestCount} guests`}
        actions={
          <Button asChild variant="secondary">
            <Link href="/home-chef/requests">All requests</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone={statusTone[request.status]}>{request.status}</Badge>
        <Badge tone="info">{request.countryCode}</Badge>
        {request.assignedChefOrganization ? (
          <Badge tone="success">Matched with {request.assignedChefOrganization.name}</Badge>
        ) : (
          <Badge tone="neutral">Not matched yet</Badge>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {(request.quotedAmount || request.depositAmount) && request.paymentStatus !== "paid" ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <h2 className="font-semibold text-emerald-950">Secure payment</h2>
              <p className="mt-2 text-sm text-emerald-800">Pay through Stripe hosted checkout. NizamKitchen never stores card numbers or CVV.</p>
              <div className="mt-4 flex flex-col gap-3">
                {request.depositAmount ? (
                  <form action={createHomeChefCheckoutAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="paymentType" value="deposit" />
                    <TextInput label="Promo code" name="promoCode" placeholder="Optional" />
                    <Button type="submit" className="w-full">Pay deposit {request.currencyCode} {request.depositAmount}</Button>
                  </form>
                ) : null}
                {request.depositAmount ? (
                  <form action={createPayPalHomeChefCheckoutAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="paymentType" value="deposit" />
                    <TextInput label="Promo code" name="promoCode" placeholder="Optional" />
                    <Button type="submit" variant="secondary" className="w-full">Pay deposit with PayPal</Button>
                  </form>
                ) : null}
                {request.quotedAmount ? (
                  <form action={createHomeChefCheckoutAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="paymentType" value="full" />
                    <TextInput label="Promo code" name="promoCode" placeholder="Optional" />
                    <Button type="submit" variant="secondary" className="w-full">Pay full quote {request.currencyCode} {request.quotedAmount}</Button>
                  </form>
                ) : null}
                {request.quotedAmount ? (
                  <form action={createPayPalHomeChefCheckoutAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="paymentType" value="full" />
                    <TextInput label="Promo code" name="promoCode" placeholder="Optional" />
                    <Button type="submit" variant="secondary" className="w-full">Pay full quote with PayPal</Button>
                  </form>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Request brief</h2>
            {request.description ? (
              <p className="text-sm leading-6 text-[var(--color-muted)]">{request.description}</p>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No description was added.</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Food requested" value={request.recipe?.name ?? request.title} />
              <Info label="Time window" value={request.requestedTimeWindow} />
              <Info label="Household size" value={request.householdSize?.toString()} />
              <Info label="Phone" value={request.phone} />
              <Info label="Preferred language" value={request.preferredLanguage} />
              <Info label="Budget" value={request.budgetAmount ? `${request.budgetAmount} ${request.budgetCurrency}` : null} />
              <Info label="Gender preference" value={request.genderPreference.replace(/_/g, " ")} />
            </div>
            {request.notes ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Household notes</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{request.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Linked planning</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {request.recipe ? (
                <Link href={`/recipes/${request.recipe.id}`} className="rounded-2xl border border-[var(--color-border)] p-4 hover:bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recipe</p>
                  <p className="mt-2 font-semibold text-[var(--color-ink)]">{request.recipe.name}</p>
                </Link>
              ) : null}
              {request.mealPlan ? (
                <Link href={`/meal-plans/${request.mealPlan.id}`} className="rounded-2xl border border-[var(--color-border)] p-4 hover:bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meal plan</p>
                  <p className="mt-2 font-semibold text-[var(--color-ink)]">{request.mealPlan.name}</p>
                </Link>
              ) : null}
              {!request.recipe && !request.mealPlan ? (
                <p className="text-sm text-[var(--color-muted)]">No recipe or meal plan is linked to this request.</p>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-5">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Messages</h2>
            <div className="space-y-3">
              {request.messages.filter((message) => !message.isInternal).length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No messages yet.</p>
              ) : (
                request.messages
                  .filter((message) => !message.isInternal)
                  .map((message) => (
                    <div key={message.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--color-ink)]">{message.senderUser.fullName}</p>
                        <Badge tone={message.senderRole === "household" ? "neutral" : "info"}>{message.senderRole}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{message.message}</p>
                    </div>
                  ))
              )}
            </div>
            <form action={createHomeChefMessageAction} className="space-y-3">
              <input type="hidden" name="requestId" value={request.id} />
              <TextArea label="Send message to support" name="message" required />
              <Button type="submit">Send message</Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
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

          {canCancel ? (
            <Card className="border-amber-200 bg-amber-50">
              <h2 className="font-semibold text-amber-950">Cancel request</h2>
              <p className="mt-2 text-sm text-amber-800">
                You can cancel this request while it is still active. Completed requests cannot be cancelled.
              </p>
              <form action={cancelHomeChefRequestAction} className="mt-4 space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <TextArea label="Cancellation note" name="note" defaultValue="Cancelled by household." />
                <Button type="submit" variant="danger">Cancel request</Button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
      {request.status === "completed" && !review ? (
        <ReviewCreateForm action={createHomeChefReviewAction} homeChefRequestId={request.id} />
      ) : null}
      {review ? (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Your chef review</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Status: {review.status}. Reviews are published only after moderation.</p>
        </Card>
      ) : null}
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
