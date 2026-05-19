import { notFound } from "next/navigation";
import { FoodOrderMessageForm } from "@/components/food-orders/order-forms";
import { FoodOrderMessages, FoodOrderSummary } from "@/components/food-orders/order-detail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getCustomerFoodOrder } from "@/server/food-orders";
import { cancelCustomerFoodOrderAction, createCustomerFoodOrderMessageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "household") {
    return <EmptyState title="Household orders only" description="This page is available for household order requests." />;
  }
  const { id } = await params;
  const order = await getCustomerFoodOrder(session.activeOrganization.id, id);
  if (!order) notFound();
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
    </div>
  );
}
