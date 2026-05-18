"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateNotificationPreference } from "@/server/notifications/notification-service";

export async function updateNotificationPreferenceAction(formData: FormData) {
  try {
    const session = await requireUser();
    await updateNotificationPreference(session, {
      emailEnabled: formData.get("emailEnabled") === "on",
      inAppEnabled: formData.get("inAppEnabled") === "on",
      homeChefUpdates: formData.get("homeChefUpdates") === "on",
      chefRequestMessages: formData.get("chefRequestMessages") === "on",
      groceryReminders: formData.get("groceryReminders") === "on",
      mealPlanReminders: formData.get("mealPlanReminders") === "on",
      adminAlerts: formData.get("adminAlerts") === "on",
      marketingEmails: formData.get("marketingEmails") === "on",
    });
    revalidatePath("/settings/notifications");
    redirect("/settings/notifications?message=Notification preferences saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/settings/notifications?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save notification preferences."))}`);
  }
}
