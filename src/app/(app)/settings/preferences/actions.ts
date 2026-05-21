"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { updateUserLocalizationPreferences } from "@/server/localization/localization-service";

export async function saveUserPreferencesAction(formData: FormData) {
  const session = await requireMembership();
  try {
    await updateUserLocalizationPreferences(session, formData);
    revalidatePath("/settings");
    revalidatePath("/settings/preferences");
    redirect("/settings/preferences?message=Preferences saved.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save preferences.";
    redirect(`/settings/preferences?message=${encodeURIComponent(message)}`);
  }
}
