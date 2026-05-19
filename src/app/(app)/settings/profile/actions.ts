"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateUserProfile } from "@/server/users/profile";

export async function updateUserProfileAction(formData: FormData) {
  try {
    const session = await requireUser();
    await updateUserProfile({
      userId: session.user.id,
      input: {
        fullName: formData.get("fullName"),
        profilePhotoFileId: formData.get("profilePhotoFileId"),
        coverPhotoFileId: formData.get("coverPhotoFileId"),
        headline: formData.get("headline"),
        bio: formData.get("bio"),
        location: formData.get("location"),
      },
    });
    revalidatePath("/settings/profile");
    redirect("/settings/profile?message=Profile saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/settings/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save profile."))}`);
  }
}
