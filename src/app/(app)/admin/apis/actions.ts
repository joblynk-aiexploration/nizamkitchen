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

function withMessage(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}message=${encodeURIComponent(message)}`;
}

export async function saveApiIntegrationAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
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

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integration.id}`), "API integration saved."));
}

export async function saveApiCredentialAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  await savePlatformIntegrationCredential(session, {
    integrationId,
    keyName: formData.get("keyName")?.toString(),
    secretValue: formData.get("secretValue")?.toString(),
    isPublicClientValue: checkboxValue(formData, "isPublicClientValue"),
  });

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), "Encrypted credential saved. Full secret remains hidden."));
}

export async function saveApiSettingAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  await savePlatformIntegrationSetting(session, {
    integrationId,
    settingKey: formData.get("settingKey")?.toString(),
    settingValueJson: formData.get("settingValueJson")?.toString(),
    settingValueText: formData.get("settingValueText")?.toString(),
    isSecret: checkboxValue(formData, "isSecret"),
  });

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), "API setting saved."));
}

export async function runApiTestAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  await runPlatformIntegrationTest(session, {
    integrationId,
    testType: formData.get("testType")?.toString() ?? "configuration_check",
  });

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), "API test logged."));
}
