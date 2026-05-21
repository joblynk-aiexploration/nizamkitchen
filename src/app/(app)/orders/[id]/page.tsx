import { notFound } from "next/navigation";
import { FoodOrderMessageForm } from "@/components/food-orders/order-forms";
import { FoodOrderMessages, FoodOrderSummary } from "@/components/food-orders/order-detail";
import { ReviewCreateForm } from "@/components/reviews/review-components";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getCustomerFoodOrder } from "@/server/food-orders";
import { getCustomerFoodOrderReview } from "@/server/trust/review-service";
import { cancelCustomerFoodOrderAction, createCustomerFoodOrderMessageAction, createFoodOrderCheckoutAction, createFoodOrderReviewAction, createPayPalFoodOrderCheckoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "household") {
    return <EmptyState title="Household orders only" description="This page is available for household order requests." />;
  }
  const { id } = await params;
  const order = await getCustomerFoodOrder(session.activeOrganization.id, id);
  if (!order) notFound();
  const review = await getCustomerFoodOrderReview(order.id, session.activeOrganization.id, session.user.id);
  const canCancel = ["draft", "submitted"].includes(order.status);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Order request" title={`Order ${order.id.slice(-6).toUpperCase()}`} description="Track status, timeline, and messages for this manual order request." />
      <FoodOrderSummary order={order} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FoodOrderMessages order={order} />
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Actions</h2>
          <div className="mt-5 space-y-5">
            {order.subtotalAmount && order.paymentStatus !== "paid" ? (
              <form action={createFoodOrderCheckoutAction} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <input type="hidden" name="orderId" value={order.id} />
                <p className="text-sm font-semibold text-emerald-950">Payment</p>
                <p className="mt-1 text-sm text-emerald-800">Pay securely with Stripe hosted checkout. NizamKitchen never sees card numbers or CVV.</p>
                <Button type="submit" className="mt-4 w-full">Pay with Stripe</Button>
              </form>
            ) : null}
            {order.subtotalAmount && order.paymentStatus !== "paid" ? (
              <form action={createPayPalFoodOrderCheckoutAction} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <input type="hidden" name="orderId" value={order.id} />
                <p className="text-sm font-semibold text-blue-950">PayPal</p>
                <p className="mt-1 text-sm text-blue-800">PayPal approval redirects back to NizamKitchen for server-side capture confirmation.</p>
                <Button type="submit" variant="secondary" className="mt-4 w-full">Pay with PayPal</Button>
              </form>
            ) : null}
            <FoodOrderMessageForm action={createCustomerFoodOrderMessageAction} orderId={order.id} />
            {canCancel ? (
              <form action={cancelCustomerFoodOrderAction} className="space-y-3 border-t border-[var(--color-border)] pt-5">
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit" variant="danger">Cancel request</Button>
              </form>
            ) : null}
          </div>
        </Card>
      </div>
      {order.status === "completed" && !review ? (
        <ReviewCreateForm action={createFoodOrderReviewAction} foodOrderId={order.id} />
      ) : null}
      {review ? (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Your review</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Status: {review.status}. Reviews are published only after moderation.</p>
        </Card>
      ) : null}
    </div>
  );
}
