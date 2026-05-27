"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { normalizePhoneFromForm } from "@/lib/phone";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateUserProfile } from "@/server/users/profile";

export async function updateUserProfileAction(formData: FormData) {
  try {
    const session = await requireUser();
    await updateUserProfile({
      userId: session.user.id,
      input: {
        email: formData.get("email"),
        fullName: formData.get("fullName"),
        profilePhotoFileId: formData.get("profilePhotoFileId"),
        coverPhotoFileId: formData.get("coverPhotoFileId"),
        headline: formData.get("headline"),
        bio: formData.get("bio"),
        locationText: formData.get("locationText"),
        phone: normalizePhoneFromForm(formData),
        religion: formData.get("religion"),
        preferredLanguage: formData.get("preferredLanguage"),
        addressLine1: formData.get("addressLine1"),
        addressLine2: formData.get("addressLine2"),
        city: formData.get("city"),
        region: formData.get("region"),
        countryCode: formData.get("countryCode"),
        postalCode: formData.get("postalCode"),
        latitude: formData.get("latitude"),
        longitude: formData.get("longitude"),
        providerPlaceId: formData.get("providerPlaceId"),
        locationVisibility: formData.get("locationVisibility"),
        publicProfileEnabled: formData.get("publicProfileEnabled") === "on",
      },
    });
    revalidatePath("/settings/profile");
    revalidatePath("/profile");
    revalidatePath(`/users/${session.user.id}`);
    redirect("/settings/profile?message=Successfully saved profile.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/settings/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save profile."))}`);
  }
}
