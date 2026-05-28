import { notFound } from "next/navigation";
import { FoodOrderMessages, FoodOrderSummary } from "@/components/food-orders/order-detail";
import { FoodOrderStatusForm } from "@/components/food-orders/order-forms";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminFoodOrder } from "@/server/food-orders";
import { updateAdminFoodOrderStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminFoodOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const order = await getAdminFoodOrder(session, id);
  if (!order) notFound();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin food order" title={`Order ${order.id.slice(-6).toUpperCase()}`} description="Review order timeline, notes, and manual support state." />
      <FoodOrderSummary order={order} showInternal />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FoodOrderMessages order={order} showInternal />
        <Card>
          <FoodOrderStatusForm action={updateAdminFoodOrderStatusAction} orderId={order.id} admin />
        </Card>
      </div>
    </div>
  );
}
