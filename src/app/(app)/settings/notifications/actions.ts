"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateEmailPreference } from "@/server/email/email-service";
import { getNotificationPreference, updateNotificationPreference } from "@/server/notifications/notification-service";
import {
  visibleEmailPreferenceFieldNames,
  visibleNotificationPreferenceFieldNames,
  type EmailPreferenceFieldName,
  type NotificationPreferenceFieldName,
} from "./preference-fields";

const notificationPreferenceNames: NotificationPreferenceFieldName[] = [
  "emailEnabled",
  "inAppEnabled",
  "homeChefUpdates",
  "chefRequestMessages",
  "groceryReminders",
  "mealPlanReminders",
  "adminAlerts",
  "marketingEmails",
];

export async function updateNotificationPreferenceAction(formData: FormData) {
  try {
    const session = await requireUser();
    const visibilityContext = {
      platformRole: session.user.platformRole,
      organizationType: session.activeOrganization?.organizationType,
      membershipRole: session.activeMembership?.role,
    };
    const visibleNotificationNames = new Set(visibleNotificationPreferenceFieldNames(visibilityContext));
    const visibleEmailNames = visibleEmailPreferenceFieldNames(visibilityContext);
    const existingNotificationPreference = await getNotificationPreference(session.user.id);
    await updateNotificationPreference(session, Object.fromEntries(notificationPreferenceNames.map((name) => [
      name,
      visibleNotificationNames.has(name) ? formData.get(name) === "on" : existingNotificationPreference[name],
    ])));
    await updateEmailPreference(session.user.id, Object.fromEntries(visibleEmailNames.map((name: EmailPreferenceFieldName) => [
      name,
      formData.get(name) === "on",
    ])));
    revalidatePath("/settings/notifications");
    redirect("/settings/notifications?message=Successfully saved notification preferences.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/settings/notifications?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save notification preferences."))}`);
  }
}
