"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  anonymizeOrganizationForRequest,
  anonymizeUserForRequest,
  generatePrivacyExport,
  updateAdminPrivacyRequest,
  upsertRetentionPolicy,
} from "@/server/privacy/privacy-service";

const PRIVACY_MANAGE_ROLES = ["platform_owner", "platform_admin"] as const;

export async function updatePrivacyRequestAction(requestId: string, formData: FormData) {
  const session = await requirePlatformRole([...PRIVACY_MANAGE_ROLES]);
  await updateAdminPrivacyRequest(session, requestId, {
    status: formData.get("status"),
    adminNotes: formData.get("adminNotes"),
  });
  revalidatePath("/admin/privacy");
  revalidatePath("/admin/privacy/requests");
  revalidatePath(`/admin/privacy/requests/${requestId}`);
}

export async function generatePrivacyExportAction(requestId: string) {
  const session = await requirePlatformRole([...PRIVACY_MANAGE_ROLES]);
  await generatePrivacyExport(session, requestId);
  revalidatePath("/admin/privacy");
  revalidatePath("/admin/privacy/requests");
  revalidatePath(`/admin/privacy/requests/${requestId}`);
}

export async function anonymizeUserAction(requestId: string) {
  const session = await requirePlatformRole([...PRIVACY_MANAGE_ROLES]);
  await anonymizeUserForRequest(session, requestId);
  revalidatePath("/admin/privacy");
  revalidatePath("/admin/privacy/requests");
  revalidatePath(`/admin/privacy/requests/${requestId}`);
}

export async function anonymizeOrganizationAction(requestId: string) {
  const session = await requirePlatformRole([...PRIVACY_MANAGE_ROLES]);
  await anonymizeOrganizationForRequest(session, requestId);
  revalidatePath("/admin/privacy");
  revalidatePath("/admin/privacy/requests");
  revalidatePath(`/admin/privacy/requests/${requestId}`);
}

export async function upsertRetentionPolicyAction(formData: FormData) {
  const session = await requirePlatformRole([...PRIVACY_MANAGE_ROLES]);
  await upsertRetentionPolicy(session, {
    id: formData.get("id") || undefined,
    countryCode: formData.get("countryCode"),
    dataCategory: formData.get("dataCategory"),
    retentionDays: formData.get("retentionDays"),
    action: formData.get("action"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
  revalidatePath("/admin/privacy/retention");
}
