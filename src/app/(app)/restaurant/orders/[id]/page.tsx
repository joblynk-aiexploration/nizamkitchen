import { notFound } from "next/navigation";
import { FoodOrderMessages, FoodOrderSummary } from "@/components/food-orders/order-detail";
import { FoodOrderMessageForm, FoodOrderStatusForm } from "@/components/food-orders/order-forms";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getSellerFoodOrder } from "@/server/food-orders";
import { createRestaurantFoodOrderMessageAction, updateRestaurantFoodOrderStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RestaurantOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Seller order details are available to restaurant organizations." />;
  }
  const { id } = await params;
  const order = await getSellerFoodOrder(session.activeOrganization.id, id);
  if (!order) notFound();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant order" title={`Order ${order.id.slice(-6).toUpperCase()}`} description="Accept, decline, update status, and message the customer." />
      <FoodOrderSummary order={order} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FoodOrderMessages order={order} />
        <Card className="space-y-6">
          <FoodOrderStatusForm action={updateRestaurantFoodOrderStatusAction} orderId={order.id} />
          <FoodOrderMessageForm action={createRestaurantFoodOrderMessageAction} orderId={order.id} label="Message customer" />
        </Card>
      </div>
    </div>
  );
}
