"use server";

import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  runPlatformIntegrationTest,
  savePlatformIntegration,
  savePlatformIntegrationCredential,
  savePlatformIntegrationSetting,
} from "@/server/config/platform-config-service";

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function redirectTarget(formData: FormData, fallback: string) {
  const candidate = formData.get("returnTo")?.toString();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}

export async function savePlatformIntegrationAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  const id = formData.get("id")?.toString() || undefined;
  const integration = await savePlatformIntegration(session, {
    id,
    provider: formData.get("provider")?.toString(),
    category: formData.get("category")?.toString(),
    displayName: formData.get("displayName")?.toString(),
    description: formData.get("description")?.toString(),
    status: formData.get("status")?.toString(),
    environment: formData.get("environment")?.toString(),
    countryCode: formData.get("countryCode")?.toString(),
    region: formData.get("region")?.toString(),
    isGlobal: checkboxValue(formData, "isGlobal"),
    isDefault: checkboxValue(formData, "isDefault"),
  });

  redirect(`${redirectTarget(formData, `/admin/configuration/integrations/${integration.id}`)}?message=Integration saved.`);
}

export async function savePlatformIntegrationCredentialAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  await savePlatformIntegrationCredential(session, {
    integrationId,
    keyName: formData.get("keyName")?.toString(),
    secretValue: formData.get("secretValue")?.toString(),
    isPublicClientValue: checkboxValue(formData, "isPublicClientValue"),
  });

  redirect(`${redirectTarget(formData, `/admin/configuration/integrations/${integrationId}`)}?message=Encrypted credential saved. Full secret remains hidden.`);
}

export async function savePlatformIntegrationSettingAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  await savePlatformIntegrationSetting(session, {
    integrationId,
    settingKey: formData.get("settingKey")?.toString(),
    settingValueJson: formData.get("settingValueJson")?.toString(),
    settingValueText: formData.get("settingValueText")?.toString(),
    isSecret: checkboxValue(formData, "isSecret"),
  });

  redirect(`${redirectTarget(formData, `/admin/configuration/integrations/${integrationId}`)}?message=Integration setting saved.`);
}

export async function runPlatformIntegrationTestAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  await runPlatformIntegrationTest(session, {
    integrationId,
    testType: formData.get("testType")?.toString() ?? "configuration_check",
  });

  redirect(`${redirectTarget(formData, `/admin/configuration/integrations/${integrationId}`)}?message=Integration test logged.`);
}
