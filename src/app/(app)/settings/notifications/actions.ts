"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateEmailPreference } from "@/server/email/email-service";
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
    await updateEmailPreference(session.user.id, {
      transactionalEnabled: formData.get("transactionalEnabled") === "on",
      marketingEnabled: formData.get("marketingEnabled") === "on",
      mealPlanningEmails: formData.get("mealPlanningEmails") === "on",
      groceryEmails: formData.get("groceryEmails") === "on",
      orderEmails: formData.get("orderEmails") === "on",
      homeChefEmails: formData.get("homeChefEmails") === "on",
      sellerEmails: formData.get("sellerEmails") === "on",
      paymentEmails: formData.get("paymentEmails") === "on",
      verificationEmails: formData.get("verificationEmails") === "on",
      supportEmails: formData.get("supportEmails") === "on",
      reviewEmails: formData.get("reviewEmails") === "on",
      promotionEmails: formData.get("promotionEmails") === "on",
      adminAlertEmails: formData.get("adminAlertEmails") === "on",
    });
    revalidatePath("/settings/notifications");
    redirect("/settings/notifications?message=Successfully saved notification preferences.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/settings/notifications?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save notification preferences."))}`);
  }
}
