"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { normalizePhoneFromForm } from "@/lib/phone";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { deleteBusinessSocialLink, upsertBusinessSocialLink } from "@/server/business-social-links";
import { upsertPrimaryLocation } from "@/server/maps/location-service";
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

function parseLocationNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function upsertHomeCateringProfileAction(formData: FormData) {
  try {
    const session = await requireHomeCateringAccess();
    const profile = await upsertHomeCateringProfile({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: {
        displayName: formData.get("displayName"),
        ownerName: formData.get("ownerName"),
        bio: formData.get("bio"),
        operationType: formData.get("operationType"),
        restaurantName: formData.get("restaurantName"),
        restaurantAddress: formData.get("restaurantAddress"),
        restaurantLicense: formData.get("restaurantLicense"),
        profilePhotoUrl: formData.get("profilePhotoUrl"),
        coverPhotoUrl: formData.get("coverPhotoUrl"),
        profilePhotoFileId: formData.get("profilePhotoFileId"),
        coverPhotoFileId: formData.get("coverPhotoFileId"),
        cuisineSpecialties: formData.get("cuisineSpecialties"),
        languages: formData.get("languages"),
        serviceAreaText: formData.get("serviceAreaText"),
        city: formData.get("city"),
        region: formData.get("region"),
        postalCode: formData.get("postalCode"),
        phone: normalizePhoneFromForm(formData),
        email: formData.get("email"),
        acceptsPickup: formData.get("acceptsPickup") === "on",
        acceptsDelivery: formData.get("acceptsDelivery") === "on",
        acceptsPreorders: formData.get("acceptsPreorders") === "on",
        minimumNoticeHours: formData.get("minimumNoticeHours"),
        submitForVerification: formData.get("submitForVerification") === "on",
      },
    });
    await upsertPrimaryLocation({
      organizationId: session.activeOrganization.id,
      userId: session.user.id,
      entityType: "home_catering_profile",
      entityId: profile.id,
      label: "Primary service location",
      addressLine1: String(formData.get("serviceAddressLine1") ?? ""),
      addressLine2: String(formData.get("serviceAddressLine2") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      countryCode: String(formData.get("locationCountryCode") ?? session.activeOrganization.countryCode),
      postalCode: String(formData.get("postalCode") ?? ""),
      latitude: parseLocationNumber(formData.get("locationLatitude")),
      longitude: parseLocationNumber(formData.get("locationLongitude")),
      providerPlaceId: String(formData.get("locationProviderPlaceId") ?? ""),
    });
    revalidateCateringPaths();
    redirect("/catering/profile?message=Successfully saved home catering profile.");
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
    redirect("/catering?message=Successfully updated home catering profile status.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update profile status."))}`);
  }
}

export async function upsertCateringSocialLinkAction(formData: FormData) {
  try {
    const session = await requireHomeCateringAccess();
    await upsertBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      organizationType: session.activeOrganization.organizationType,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateCateringPaths();
    redirect("/catering/profile?message=Successfully saved social link.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save social link."))}`);
  }
}

export async function deleteCateringSocialLinkAction(formData: FormData) {
  try {
    const session = await requireHomeCateringAccess();
    await deleteBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateCateringPaths();
    redirect("/catering/profile?message=Successfully deleted social link.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to delete social link."))}`);
  }
}

function revalidateCateringPaths() {
  revalidatePath("/catering");
  revalidatePath("/catering/profile");
  revalidatePath("/caterers");
  revalidatePath("/admin/home-catering");
}
