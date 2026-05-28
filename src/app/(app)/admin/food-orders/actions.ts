"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { updateAdminFoodOrderStatus } from "@/server/food-orders";

export async function updateAdminFoodOrderStatusAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
  const orderId = String(formData.get("orderId") ?? "");
  await updateAdminFoodOrderStatus({ session, orderId, input: Object.fromEntries(formData) });
  revalidatePath(`/admin/food-orders/${orderId}`);
  revalidatePath("/admin/food-orders");
}
