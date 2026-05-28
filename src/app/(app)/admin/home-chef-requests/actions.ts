"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  assignHomeChefRequest,
  createAdminHomeChefRequestMessage,
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
