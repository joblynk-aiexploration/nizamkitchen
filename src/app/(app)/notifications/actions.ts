"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { markAllNotificationsRead, markNotificationRead } from "@/server/notifications/notification-service";

export async function markNotificationReadAction(formData: FormData) {
  try {
    const session = await requireUser();
    await markNotificationRead(session, String(formData.get("notificationId")));
    revalidatePath("/notifications");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/notifications?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to mark notification as read."))}`);
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const session = await requireUser();
    await markAllNotificationsRead(session);
    revalidatePath("/notifications");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/notifications?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to mark notifications as read."))}`);
  }
}
