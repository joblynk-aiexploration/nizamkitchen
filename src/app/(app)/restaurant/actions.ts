"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { deleteBusinessSocialLink, upsertBusinessSocialLink } from "@/server/business-social-links";
import { createAuditEvent } from "@/server/audit";
import { upsertPrimaryLocation } from "@/server/maps/location-service";
import { updateOrganizationMedia } from "@/server/organizations/media";

async function requireRestaurantAccess() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    redirect("/dashboard?message=Restaurant tools are only for restaurant organizations.");
  }
  return session;
}

function parseLocationNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function upsertRestaurantSocialLinkAction(formData: FormData) {
  try {
    const session = await requireRestaurantAccess();
    await upsertBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      organizationType: session.activeOrganization.organizationType,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateRestaurantPaths();
    redirect("/restaurant/profile?message=Successfully saved social link.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save social link."))}`);
  }
}

export async function deleteRestaurantSocialLinkAction(formData: FormData) {
  try {
    const session = await requireRestaurantAccess();
    await deleteBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateRestaurantPaths();
    redirect("/restaurant/profile?message=Successfully deleted social link.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to delete social link."))}`);
  }
}

export async function updateRestaurantProfileBasicsAction(formData: FormData) {
  try {
    const session = await requireRestaurantAccess();
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 120) {
      throw new Error("Restaurant name must be between 2 and 120 characters.");
    }

    await prisma.organization.update({
      where: { id: session.activeOrganization.id },
      data: { name },
    });
    await createAuditEvent({
      actorUserId: session.user.id,
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      action: "restaurant_profile.updated",
      targetType: "organization",
      targetId: session.activeOrganization.id,
      details: { name },
    });
    revalidateRestaurantPaths();
    revalidatePath("/settings");
    redirect("/restaurant/profile?message=Successfully saved restaurant profile.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save restaurant profile."))}`);
  }
}

export async function updateRestaurantMediaAction(formData: FormData) {
  try {
    const session = await requireRestaurantAccess();
    await updateOrganizationMedia({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      logoFileId: String(formData.get("logoFileId") ?? ""),
      coverPhotoFileId: String(formData.get("coverPhotoFileId") ?? ""),
    });
    revalidateRestaurantPaths();
    redirect("/restaurant/profile?message=Successfully saved restaurant images.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save restaurant images."))}`);
  }
}

export async function updateRestaurantLocationAction(formData: FormData) {
  try {
    const session = await requireRestaurantAccess();
    await upsertPrimaryLocation({
      organizationId: session.activeOrganization.id,
      userId: session.user.id,
      entityType: "organization",
      entityId: session.activeOrganization.id,
      label: "Restaurant location",
      addressLine1: String(formData.get("addressLine1") ?? ""),
      addressLine2: String(formData.get("addressLine2") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      countryCode: String(formData.get("locationCountryCode") ?? session.activeOrganization.countryCode),
      postalCode: String(formData.get("postalCode") ?? ""),
      latitude: parseLocationNumber(formData.get("locationLatitude")),
      longitude: parseLocationNumber(formData.get("locationLongitude")),
      providerPlaceId: String(formData.get("locationProviderPlaceId") ?? ""),
    });
    revalidateRestaurantPaths();
    redirect("/restaurant/profile?message=Successfully saved restaurant location.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save restaurant location."))}`);
  }
}

function revalidateRestaurantPaths() {
  revalidatePath("/restaurant");
  revalidatePath("/restaurant/profile");
  revalidatePath("/restaurants");
}
