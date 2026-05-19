"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { moderateMenuItem } from "@/server/menus";

export async function moderateMenuItemAction(formData: FormData) {
  const menuItemId = String(formData.get("menuItemId"));
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
    await moderateMenuItem({
      session,
      menuItemId,
      input: {
        status: formData.get("status"),
        reason: formData.get("reason"),
      },
    });
    revalidatePath("/admin/menu-items");
    redirect("/admin/menu-items?message=Menu item moderated.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/menu-items?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to moderate menu item."))}`);
  }
}
