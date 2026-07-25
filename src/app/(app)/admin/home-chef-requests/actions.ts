"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  assignHomeChefRequest,
  createHomeChefRequestOffer,
  createAdminHomeChefRequestMessage,
  lockBooking,
  revokeBookingAccess,
  triggerHomeChefCascade,
  updateAdminHomeChefRequestStatus,
} from "@/server/home-chef";

async function requireHomeChefAdminSession() {
  return requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
}

export async function updateAdminHomeChefStatusAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefAdminSession();
    await updateAdminHomeChefRequestStatus({
      session,
      requestId,
      input: {
        status: formData.get("status"),
        note: formData.get("note"),
      },
    });

    revalidatePath("/admin/home-chef-requests");
    revalidatePath(`/admin/home-chef-requests/${requestId}`);
    revalidatePath("/chef/requests");
    redirect(`/admin/home-chef-requests/${requestId}?message=Request status updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update request status."))}`);
  }
}

export async function assignHomeChefRequestAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefAdminSession();
    await assignHomeChefRequest({
      session,
      requestId,
      input: {
        assignedChefOrganizationId: formData.get("assignedChefOrganizationId"),
        note: formData.get("note"),
      },
    });

    revalidatePath("/admin/home-chef-requests");
    revalidatePath(`/admin/home-chef-requests/${requestId}`);
    revalidatePath("/chef/requests");
    redirect(`/admin/home-chef-requests/${requestId}?message=Chef assignment updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to assign chef organization."))}`);
  }
}

export async function createHomeChefOfferAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefAdminSession();
    await createHomeChefRequestOffer({
      session,
      requestId,
      input: {
        chefProfileId: formData.get("chefProfileId"),
        responseWindowMinutes: formData.get("responseWindowMinutes"),
        offerType: "direct",
        quoteAmount: formData.get("quoteAmount"),
        currencyCode: formData.get("currencyCode"),
        adminNotes: formData.get("adminNotes"),
      },
    });

    revalidatePath("/admin/home-chef-requests");
    revalidatePath(`/admin/home-chef-requests/${requestId}`);
    revalidatePath("/chef/requests");
    redirect(`/admin/home-chef-requests/${requestId}?message=Chef offer sent.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to send chef offer."))}`);
  }
}

export async function triggerHomeChefCascadeAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefAdminSession();
    const offer = await triggerHomeChefCascade({ session, requestId });
    revalidatePath("/admin/home-chef-requests");
    revalidatePath(`/admin/home-chef-requests/${requestId}`);
    revalidatePath("/chef/requests");
    redirect(`/admin/home-chef-requests/${requestId}?message=${offer ? "Cascade offer sent." : "No eligible chef was available for cascade."}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to trigger cascade."))}`);
  }
}

export async function createAdminHomeChefMessageAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefAdminSession();
    await createAdminHomeChefRequestMessage({
      session,
      requestId,
      input: {
        message: formData.get("message"),
        isInternal: formData.get("isInternal") === "on",
      },
    });

    revalidatePath(`/admin/home-chef-requests/${requestId}`);
    redirect(`/admin/home-chef-requests/${requestId}?message=Message added.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add message."))}`);
  }
}

export async function lockHomeChefBookingAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));
  try {
    const session = await requireHomeChefAdminSession();
    await lockBooking(requestId, String(formData.get("reason") || "Admin confirmed booking."), session.user.id);
    revalidatePath("/admin/home-chef-requests");
    revalidatePath(`/admin/home-chef-requests/${requestId}`);
    revalidatePath("/chef/requests");
    redirect(`/admin/home-chef-requests/${requestId}?message=Booking locked and logistics access granted.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to lock booking."))}`);
  }
}

export async function revokeHomeChefAccessAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));
  try {
    const session = await requireHomeChefAdminSession();
    await revokeBookingAccess(requestId, String(formData.get("reason") || "Admin revoked logistics access."), session.user.id);
    revalidatePath("/admin/home-chef-requests");
    revalidatePath(`/admin/home-chef-requests/${requestId}`);
    revalidatePath("/chef/requests");
    redirect(`/admin/home-chef-requests/${requestId}?message=Chef logistics access revoked.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to revoke logistics access."))}`);
  }
}
