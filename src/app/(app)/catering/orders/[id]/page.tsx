import { notFound } from "next/navigation";
import { FoodOrderMessages, FoodOrderSummary } from "@/components/food-orders/order-detail";
import { FoodOrderMessageForm, FoodOrderStatusForm } from "@/components/food-orders/order-forms";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getSellerFoodOrder } from "@/server/food-orders";
import { createCateringFoodOrderMessageAction, updateCateringFoodOrderStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CateringOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Seller order details are available to home catering organizations." />;
  }
  const { id } = await params;
  const order = await getSellerFoodOrder(session.activeOrganization.id, id);
  if (!order) notFound();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering order" title={`Order ${order.id.slice(-6).toUpperCase()}`} description="Accept, decline, update status, and message the customer." />
      <FoodOrderSummary order={order} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FoodOrderMessages order={order} />
        <Card className="space-y-6">
          <FoodOrderStatusForm action={updateCateringFoodOrderStatusAction} orderId={order.id} />
          <FoodOrderMessageForm action={createCateringFoodOrderMessageAction} orderId={order.id} label="Message customer" />
        </Card>
      </div>
    </div>
  );
}
