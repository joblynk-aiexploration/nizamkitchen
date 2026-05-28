"use server";

import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { savePaymentConfiguration } from "@/server/payments/admin";

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function savePaymentConfigurationAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  await savePaymentConfiguration(session, {
    countryCode: formData.get("countryCode")?.toString(),
    currencyCode: formData.get("currencyCode")?.toString(),
    defaultGatewayId: formData.get("defaultGatewayId")?.toString(),
    allowStripe: checkboxValue(formData, "allowStripe"),
    allowPayPal: checkboxValue(formData, "allowPayPal"),
    allowGooglePay: checkboxValue(formData, "allowGooglePay"),
    allowManualPayment: checkboxValue(formData, "allowManualPayment"),
    platformCommissionPercent: formData.get("platformCommissionPercent")?.toString(),
    fixedCommissionAmount: formData.get("fixedCommissionAmount")?.toString(),
    taxPercent: formData.get("taxPercent")?.toString(),
    status: formData.get("status")?.toString(),
  });
  redirect("/admin/payments/configurations?message=Payment configuration saved.");
}
