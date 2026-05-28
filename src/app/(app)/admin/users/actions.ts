"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { createAdminUser, deleteAdminUser } from "@/server/admin/users";

export async function createAdminUserAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const countryCodes = formData
      .getAll("countryCodes")
      .map((value) => String(value).trim().toUpperCase())
      .filter(Boolean);
    const user = await createAdminUser(session, {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      status: formData.get("status") || "active",
      platformRole: formData.get("platformRole"),
      organizationId: formData.get("organizationId"),
      organizationRole: formData.get("organizationRole") || "member",
      countryCodes,
    });

    revalidatePath("/admin/users");
    redirect(`/admin/users/${user.id}?message=Successfully created user.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/users/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create user."))}`);
  }
}

export async function deleteAdminUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");

  try {
    const session = await requirePlatformRole(["platform_owner"]);
    await deleteAdminUser(session, userId, {
      confirm: formData.get("confirm"),
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    redirect("/admin/users?message=User has been removed from platform access.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/users/${userId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove user."))}`);
  }
}
