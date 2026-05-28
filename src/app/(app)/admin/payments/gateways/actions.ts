"use server";

import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { savePaymentGateway, savePaymentGatewayCredential } from "@/server/payments/admin";

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function savePaymentGatewayAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  const id = formData.get("id")?.toString() || undefined;
  const gateway = await savePaymentGateway(session, {
    id,
    provider: formData.get("provider")?.toString(),
    displayName: formData.get("displayName")?.toString(),
    status: formData.get("status")?.toString(),
    environment: formData.get("environment")?.toString(),
    countryCode: formData.get("countryCode")?.toString(),
    supportedCountries: formData.get("supportedCountries")?.toString() ?? "",
    supportedCurrencies: formData.get("supportedCurrencies")?.toString() ?? "",
    priority: formData.get("priority")?.toString() ?? "100",
    isDefault: checkboxValue(formData, "isDefault"),
    isPlatformGateway: checkboxValue(formData, "isPlatformGateway"),
  });
  redirect(`/admin/payments/gateways/${gateway.id}?message=Payment gateway saved.`);
}

export async function savePaymentGatewayCredentialAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const gatewayId = formData.get("gatewayId")?.toString() ?? "";
  await savePaymentGatewayCredential(session, {
    gatewayId,
    keyName: formData.get("keyName")?.toString(),
    secretValue: formData.get("secretValue")?.toString(),
  });
  redirect(`/admin/payments/gateways/${gatewayId}?message=Credential saved securely. Full value is hidden.`);
}
