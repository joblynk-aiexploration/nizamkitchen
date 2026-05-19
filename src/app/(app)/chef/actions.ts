"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { deleteBusinessSocialLink, upsertBusinessSocialLink } from "@/server/business-social-links";
import {
  addChefVerificationDocument,
  addChefSpecialty,
  canAccessChefMarketplace,
  isChefBusiness,
  pauseChefProfile,
  upsertChefAvailability,
  upsertChefProfile,
  upsertChefService,
} from "@/server/chefs";

async function requireChefBusinessAccess() {
  const session = await requireMembership();
  const enabled = await canAccessChefMarketplace({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  if (!enabled) redirect("/chef?message=Home chef marketplace is not enabled.");
  if (!isChefBusiness(session.activeOrganization.organizationType)) {
    redirect("/dashboard?message=Chef marketplace tools are only for chef business organizations.");
  }
  return session;
}

export async function upsertChefProfileAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await upsertChefProfile({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: {
        displayName: formData.get("displayName"),
        bio: formData.get("bio"),
        profilePhotoUrl: formData.get("profilePhotoUrl"),
        profilePhotoFileId: formData.get("profilePhotoFileId"),
        coverPhotoFileId: formData.get("coverPhotoFileId"),
        languages: formData.get("languages"),
        specialties: formData.get("specialties"),
        yearsExperience: formData.get("yearsExperience"),
        serviceRadiusKm: formData.get("serviceRadiusKm"),
        baseCity: formData.get("baseCity"),
        baseRegion: formData.get("baseRegion"),
        postalCode: formData.get("postalCode"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        submitForVerification: formData.get("submitForVerification") === "on",
      },
    });
    revalidateChefPaths();
    redirect("/chef/profile?message=Chef profile saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save chef profile."))}`);
  }
}

export async function upsertChefServiceAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await upsertChefService({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        serviceId: formData.get("serviceId"),
        name: formData.get("name"),
        description: formData.get("description"),
        serviceType: formData.get("serviceType"),
        basePriceAmount: formData.get("basePriceAmount"),
        currencyCode: formData.get("currencyCode") || session.activeOrganization.currencyCode,
        priceUnit: formData.get("priceUnit"),
        minGuests: formData.get("minGuests"),
        maxGuests: formData.get("maxGuests"),
        isActive: formData.get("isActive") === "on",
      },
    });
    revalidateChefPaths();
    redirect("/chef/services?message=Chef service saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/services?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save chef service."))}`);
  }
}

export async function addChefVerificationDocumentAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await addChefVerificationDocument({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      documentType: String(formData.get("documentType") ?? ""),
      fileId: String(formData.get("verificationDocumentFileId") ?? ""),
    });
    revalidateChefPaths();
    redirect("/chef/profile?message=Verification document uploaded.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to upload verification document."))}`);
  }
}

export async function addChefSpecialtyAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await addChefSpecialty({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        recipeId: formData.get("recipeId"),
        dishName: formData.get("dishName"),
        notes: formData.get("notes"),
      },
    });
    revalidateChefPaths();
    redirect("/chef/profile?message=Specialty added.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add specialty."))}`);
  }
}

export async function upsertChefAvailabilityAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await upsertChefAvailability({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        dayOfWeek: formData.get("dayOfWeek"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        isAvailable: formData.get("isAvailable") === "on",
      },
    });
    revalidateChefPaths();
    redirect("/chef/availability?message=Availability saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/availability?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save availability."))}`);
  }
}

export async function pauseChefProfileAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await pauseChefProfile({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      paused: formData.get("paused") === "true",
    });
    revalidateChefPaths();
    redirect("/chef?message=Chef profile status updated.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update chef profile status."))}`);
  }
}

export async function upsertChefSocialLinkAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await upsertBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      organizationType: session.activeOrganization.organizationType,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateChefPaths();
    redirect("/chef/profile?message=Social link saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save social link."))}`);
  }
}

export async function deleteChefSocialLinkAction(formData: FormData) {
  try {
    const session = await requireChefBusinessAccess();
    await deleteBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateChefPaths();
    redirect("/chef/profile?message=Social link deleted.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to delete social link."))}`);
  }
}

function revalidateChefPaths() {
  revalidatePath("/chef");
  revalidatePath("/chef/profile");
  revalidatePath("/chef/services");
  revalidatePath("/chef/availability");
  revalidatePath("/chefs");
}
