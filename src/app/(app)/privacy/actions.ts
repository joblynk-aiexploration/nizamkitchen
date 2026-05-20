"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { createDataPrivacyRequest } from "@/server/privacy/privacy-service";

export async function createPrivacyRequestAction(formData: FormData) {
  const session = await requireMembership();
  const request = await createDataPrivacyRequest(session, {
    requestType: formData.get("requestType"),
    reason: formData.get("reason"),
  });
  revalidatePath("/privacy");
  revalidatePath("/privacy/requests");
  redirect(`/privacy/requests/${request.id}`);
}
