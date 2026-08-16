"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAnalyticsEvent } from "@/lib/analytics/events";
import { requireMembership } from "@/lib/auth/session";
import { normalizePhoneFromForm } from "@/lib/phone";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { chefServiceSchema } from "@/lib/validation/chefs";
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

export type ServiceFormState = {
  error?: string;
  fieldErrors?: {
    name?: string;
    serviceType?: string;
    basePriceAmount?: string;
    currencyCode?: string;
    priceUnit?: string;
    minGuests?: string;
    maxGuests?: string;
    description?: string;
  };
  values?: {
    serviceId: string;
    name: string;
    serviceType: string;
    basePriceAmount: string;
    currencyCode: string;
    priceUnit: string;
    minGuests: string;
    maxGuests: string;
    description: string;
    isActive: boolean;
  };
};
import {
  createChefHomeChefOrderMessage,
  updateChefHomeChefOrderStatus,
} from "@/server/home-chef";

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
        phone: normalizePhoneFromForm(formData),
        email: formData.get("email"),
        submitForVerification: formData.get("submitForVerification") === "on",
      },
    });
    revalidateChefPaths();
    redirect("/chef/profile?message=Successfully saved chef profile.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save chef profile."))}`);
  }
}

export async function upsertChefServiceAction(
  _prevState: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const rawValues: ServiceFormState["values"] = {
    serviceId: String(formData.get("serviceId") ?? ""),
    name: String(formData.get("name") ?? ""),
    serviceType: String(formData.get("serviceType") ?? "daily_cooking"),
    basePriceAmount: String(formData.get("basePriceAmount") ?? ""),
    currencyCode: String(formData.get("currencyCode") ?? ""),
    priceUnit: String(formData.get("priceUnit") ?? "per_visit"),
    minGuests: String(formData.get("minGuests") ?? ""),
    maxGuests: String(formData.get("maxGuests") ?? ""),
    description: String(formData.get("description") ?? ""),
    isActive: formData.get("isActive") === "on",
  };

  try {
    const session = await requireChefBusinessAccess();

    const inputData = {
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
    };

    // Validate first — return structured field errors without redirecting.
    const validation = chefServiceSchema.safeParse(inputData);
    if (!validation.success) {
      const fieldErrors: ServiceFormState["fieldErrors"] = {};
      for (const issue of validation.error.issues) {
        const field = String(issue.path[0] ?? "") as keyof NonNullable<ServiceFormState["fieldErrors"]>;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return { error: "Please correct the errors below.", fieldErrors, values: rawValues };
    }

    await upsertChefService({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: inputData,
    });

    revalidateChefPaths();
    redirect("/chef/services?message=Successfully saved chef service.");
  } catch (error) {
    rethrowIfRedirectError(error);
    return {
      error: getActionErrorMessage(error, "Unable to save chef service."),
      values: rawValues,
    };
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
    redirect("/chef/profile?message=Successfully uploaded verification document.");
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
    redirect("/chef/profile?message=Successfully added specialty.");
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
    redirect("/chef/availability?message=Successfully saved availability.");
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
    redirect("/chef?message=Successfully updated chef profile status.");
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
    redirect("/chef/profile?message=Successfully saved social link.");
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
    redirect("/chef/profile?message=Successfully deleted social link.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to delete social link."))}`);
  }
}

export async function acceptChefOrderAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");

  try {
    const session = await requireChefBusinessAccess();
    await updateChefHomeChefOrderStatus({
      requestId,
      chefOrganizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      status: "accepted",
      note: String(formData.get("note") || "Accepted by chef."),
    });
    revalidateChefPaths();
    revalidatePath(`/chef/requests/${requestId}`);
    revalidatePath(`/home-chef/requests/${requestId}`);
    redirect(withAnalyticsEvent(`/chef/requests/${requestId}?message=Order accepted.`, "home_chef_request_confirmed"));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to accept order."))}`);
  }
}

export async function declineChefOrderAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");

  try {
    const session = await requireChefBusinessAccess();
    await updateChefHomeChefOrderStatus({
      requestId,
      chefOrganizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      status: "declined",
      note: String(formData.get("note") || "Declined by chef."),
    });
    revalidateChefPaths();
    revalidatePath(`/chef/requests/${requestId}`);
    revalidatePath(`/home-chef/requests/${requestId}`);
    redirect(`/chef/requests/${requestId}?message=Order declined.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to decline order."))}`);
  }
}

export async function createChefOrderMessageAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");

  try {
    const session = await requireChefBusinessAccess();
    await createChefHomeChefOrderMessage({
      requestId,
      chefOrganizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: {
        message: formData.get("message"),
        isInternal: false,
      },
    });
    revalidatePath(`/chef/requests/${requestId}`);
    revalidatePath(`/home-chef/requests/${requestId}`);
    redirect(`/chef/requests/${requestId}?message=Message sent.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to send message."))}`);
  }
}

function revalidateChefPaths() {
  revalidatePath("/chef");
  revalidatePath("/chef/profile");
  revalidatePath("/chef/services");
  revalidatePath("/chef/availability");
  revalidatePath("/chef/requests");
  revalidatePath("/chefs");
}
