"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateUserLocalizationPreferences } from "@/server/localization/localization-service";

export async function saveUserPreferencesAction(formData: FormData) {
  const session = await requireMembership();
  try {
    await updateUserLocalizationPreferences(session, formData);
    revalidatePath("/settings");
    revalidatePath("/settings/preferences");
    redirect("/settings/preferences?message=Successfully saved preferences.");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = getActionErrorMessage(error, "Unable to save preferences.");
    redirect(`/settings/preferences?message=${encodeURIComponent(message)}`);
  }
}
