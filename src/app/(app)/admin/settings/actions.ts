"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { normalizePhoneFromForm } from "@/lib/phone";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { hashToken } from "@/lib/security.server";
import { createAuditEvent } from "@/server/audit";
import { updateUserLocalizationPreferences } from "@/server/localization/localization-service";
import { updateUserProfile } from "@/server/users/profile";

const ADMIN_ACCOUNT_ROLES = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
  "auditor",
] as const;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be 128 characters or fewer.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "New password and confirmation must match.",
    });
  }
});

function getPasswordChangeValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Please check the password fields and try again.";
}

export async function updateAdminAccountProfileAction(formData: FormData) {
  try {
    const session = await requirePlatformRole([...ADMIN_ACCOUNT_ROLES]);
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

    revalidatePath("/admin/settings");
    revalidatePath("/settings/profile");
    revalidatePath("/profile");
    revalidatePath(`/users/${session.user.id}`);
    redirect("/admin/settings?message=Successfully saved account settings.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/settings?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save account settings."))}`);
  }
}

export async function updateAdminPasswordAction(formData: FormData) {
  const session = await requirePlatformRole([...ADMIN_ACCOUNT_ROLES]);

  try {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      throw new Error(getPasswordChangeValidationMessage(parsed.error));
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new Error("We could not find your account. Please sign in again.");
    }

    const currentPasswordMatches = await verifyPassword(parsed.data.currentPassword, user.passwordHash);

    if (!currentPasswordMatches) {
      throw new Error("Current password is incorrect.");
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { passwordHash },
      }),
      prisma.session.deleteMany({
        where: {
          userId: session.user.id,
          tokenHash: { not: hashToken(session.sessionToken) },
        },
      }),
    ]);

    await createAuditEvent({
      actorUserId: session.user.id,
      action: "user.password_changed",
      targetType: "user",
      targetId: session.user.id,
      details: { source: "admin_account_settings", otherSessionsSignedOut: true },
    });

    revalidatePath("/admin/settings");
    redirect("/admin/settings?message=Password changed successfully. Other sessions were signed out.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/settings?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to change password."))}`);
  }
}

export async function updateAdminAccountPreferencesAction(formData: FormData) {
  const session = await requirePlatformRole([...ADMIN_ACCOUNT_ROLES]);

  try {
    await updateUserLocalizationPreferences(session, formData);
    revalidatePath("/admin/settings");
    revalidatePath("/settings/preferences");
    redirect("/admin/settings?message=Successfully saved regional preferences.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/settings?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save regional preferences."))}`);
  }
}
