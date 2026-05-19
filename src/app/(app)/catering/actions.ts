"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  canAccessHomeCatering,
  isHomeCateringBusiness,
  pauseHomeCateringProfile,
  upsertHomeCateringProfile,
} from "@/server/home-catering";

async function requireHomeCateringAccess() {
  const session = await requireMembership();
  const enabled = await canAccessHomeCatering({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  if (!enabled) redirect("/catering?message=Home catering is not enabled.");
  if (!isHomeCateringBusiness(session.activeOrganization.organizationType)) {
    redirect("/dashboard?message=Home catering tools are only for home catering organizations.");
  }
  return session;
}

export async function upsertHomeCateringProfileAction(formData: FormData) {
  try {
    const session = await requireHomeCateringAccess();
    await upsertHomeCateringProfile({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: {
        displayName: formData.get("displayName"),
        ownerName: formData.get("ownerName"),
        bio: formData.get("bio"),
        profilePhotoUrl: formData.get("profilePhotoUrl"),
        coverPhotoUrl: formData.get("coverPhotoUrl"),
        cuisineSpecialties: formData.get("cuisineSpecialties"),
        languages: formData.get("languages"),
        serviceAreaText: formData.get("serviceAreaText"),
        city: formData.get("city"),
        region: formData.get("region"),
        postalCode: formData.get("postalCode"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        acceptsPickup: formData.get("acceptsPickup") === "on",
        acceptsDelivery: formData.get("acceptsDelivery") === "on",
        acceptsPreorders: formData.get("acceptsPreorders") === "on",
        minimumNoticeHours: formData.get("minimumNoticeHours"),
        submitForVerification: formData.get("submitForVerification") === "on",
      },
    });
    revalidateCateringPaths();
    redirect("/catering/profile?message=Home catering profile saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save home catering profile."))}`);
  }
}

export async function pauseHomeCateringProfileAction(formData: FormData) {
  try {
    const session = await requireHomeCateringAccess();
    await pauseHomeCateringProfile({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      paused: formData.get("paused") === "true",
    });
    revalidateCateringPaths();
    redirect("/catering?message=Home catering profile status updated.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update profile status."))}`);
  }
}

function revalidateCateringPaths() {
  revalidatePath("/catering");
  revalidatePath("/catering/profile");
  revalidatePath("/caterers");
  revalidatePath("/admin/home-catering");
}
