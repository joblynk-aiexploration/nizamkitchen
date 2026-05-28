"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { upsertGroceryPartner } from "@/server/grocery-partners";

async function requirePartnerAdmin() {
  return requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
}

export async function saveGroceryPartnerAction(formData: FormData) {
  const partnerId = formData.get("partnerId") ? String(formData.get("partnerId")) : null;
  try {
    const session = await requirePartnerAdmin();
    const partner = await upsertGroceryPartner(session, partnerId, {
      countryCode: formData.get("countryCode"),
      name: formData.get("name"),
      websiteUrl: formData.get("websiteUrl"),
      logoUrl: formData.get("logoUrl"),
      supportedRegions: formData.get("supportedRegions"),
      integrationType: formData.get("integrationType"),
      status: formData.get("status"),
      notes: formData.get("notes"),
    });
    revalidatePath("/admin/grocery-partners");
    redirect(`/admin/grocery-partners/${partner.id}?message=Grocery partner saved.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    const target = partnerId ? `/admin/grocery-partners/${partnerId}` : "/admin/grocery-partners";
    redirect(`${target}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save grocery partner."))}`);
  }
}
