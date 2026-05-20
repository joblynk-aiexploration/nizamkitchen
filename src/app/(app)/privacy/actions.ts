"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import {
  cleanupUserPrivacyData,
  clearUserActivity,
  createDataPrivacyRequest,
  updateUserPrivacySetting,
} from "@/server/privacy/privacy-service";

export async function createPrivacyRequestAction(formData: FormData) {
  const session = await requireMembership();
  const request = await createDataPrivacyRequest(session, {
    requestType: formData.get("requestType"),
    reason: formData.get("reason"),
  });
  revalidatePath("/privacy-center");
  revalidatePath("/privacy/requests");
  redirect(`/privacy/requests/${request.id}`);
}

export async function savePrivacySettingsAction(formData: FormData) {
  const session = await requireMembership();
  await updateUserPrivacySetting(session, {
    profileVisibility: formData.get("profileVisibility"),
    activityRetentionDays: formData.get("activityRetentionDays"),
    marketingEmailsEnabled: formData.get("marketingEmailsEnabled"),
    analyticsConsent: formData.get("analyticsConsent"),
    personalizedRecommendationsEnabled: formData.get("personalizedRecommendationsEnabled"),
  });
  revalidatePath("/privacy-center");
  revalidatePath("/privacy-center/settings");
}

export async function clearUserActivityAction() {
  const session = await requireMembership();
  await clearUserActivity(session);
  revalidatePath("/privacy-center");
  revalidatePath("/privacy-center/activity");
}

export async function cleanupUserPrivacyDataAction(formData: FormData) {
  const session = await requireMembership();
  await cleanupUserPrivacyData(session, String(formData.get("cleanupType") ?? ""));
  revalidatePath("/privacy-center");
  revalidatePath("/privacy-center/data");
}
