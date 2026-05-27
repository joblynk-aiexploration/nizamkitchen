"use server";

import { redirect } from "next/navigation";
import { IntegrationProvider } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  getProviderFormDefinition,
  providerRequiredCredentialKeys,
  providerRequiredSettingKeys,
} from "@/lib/integrations/provider-fields";
import {
  deletePlatformIntegration,
  importOAuthIntegrationFromEnv,
  runPlatformIntegrationTest,
  savePlatformIntegration,
  savePlatformIntegrationCredential,
  savePlatformIntegrationSetting,
  setOAuthIntegrationSignInAvailability,
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

function friendlyApiError(error: unknown, fallback = "We could not save this API. Please check the required fields and try again.") {
  const message = error instanceof Error ? error.message : "";

  if (/ENCRYPTION_KEY/i.test(message)) {
    return "Secure secret storage is not ready. Please configure the platform encryption key before saving API secrets.";
  }

  if (/permission|denied|not allowed|unauthorized/i.test(message)) {
    return "You do not have permission to manage this API.";
  }

  if (/not found/i.test(message)) {
    return "We could not find this API configuration. Please refresh the page and try again.";
  }

  if (/invalid|required|expected|too_small|too_big|regex|\[|\{/i.test(message)) {
    return "Some API details are missing or formatted incorrectly. Please review the highlighted fields and try again.";
  }

  return message && message.length <= 180 ? message : fallback;
}

function formValue(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

function credentialValue(formData: FormData, keyName: string) {
  return formValue(formData, `credentialValue:${keyName}`);
}

function settingValue(formData: FormData, keyName: string) {
  return formValue(formData, `settingValue:${keyName}`);
}

export async function saveApiIntegrationAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const id = formData.get("id")?.toString() || undefined;
  let integration;

  try {
    integration = await savePlatformIntegration(session, {
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
  } catch (error) {
    redirect(withMessage(redirectTarget(formData, id ? `/admin/apis/${id}` : "/admin/apis"), friendlyApiError(error)));
  }

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integration.id}`), "API integration saved."));
}

export async function createApiWithSetupAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const provider = formData.get("provider")?.toString();

  if (!provider || !Object.values(IntegrationProvider).includes(provider as IntegrationProvider)) {
    redirect(withMessage("/admin/apis/new", "Choose a valid API type."));
  }

  const typedProvider = provider as IntegrationProvider;
  const providerForm = getProviderFormDefinition(typedProvider);
  const credentialKeys = formData.getAll("credentialKey").map((value) => value.toString());
  const settingKeys = formData.getAll("settingKey").map((value) => value.toString());
  const requiredCredentialKeys = providerRequiredCredentialKeys(typedProvider);
  const requiredSettingKeys = providerRequiredSettingKeys(typedProvider);
  const missingCredential = requiredCredentialKeys.find((key) => !credentialValue(formData, key));
  const missingSetting = requiredSettingKeys.find((key) => !settingValue(formData, key));

  if (missingCredential) {
    redirect(withMessage(`/admin/apis/new?provider=${typedProvider}`, `Enter ${missingCredential.replace(/_/g, " ")}.`));
  }

  if (missingSetting) {
    redirect(withMessage(`/admin/apis/new?provider=${typedProvider}`, `Enter ${missingSetting.replace(/_/g, " ")}.`));
  }

  let integration;

  try {
    integration = await savePlatformIntegration(session, {
      provider: typedProvider,
      category: providerForm.category,
      displayName: formValue(formData, "displayName") || providerForm.displayName,
      description: formValue(formData, "description") || providerForm.description,
      status: formValue(formData, "status"),
      environment: formValue(formData, "environment"),
      countryCode: formValue(formData, "countryCode"),
      region: formValue(formData, "region"),
      isGlobal: checkboxValue(formData, "isGlobal"),
      isDefault: checkboxValue(formData, "isDefault"),
    });

    for (const keyName of credentialKeys) {
      const value = credentialValue(formData, keyName);
      if (!value) continue;
      await savePlatformIntegrationCredential(session, {
        integrationId: integration.id,
        keyName,
        secretValue: value,
        isPublicClientValue: formData.get(`isPublicClientValue:${keyName}`)?.toString() === "true",
      });
    }

    for (const keyName of settingKeys) {
      const value = settingValue(formData, keyName);
      if (!value) continue;
      await savePlatformIntegrationSetting(session, {
        integrationId: integration.id,
        settingKey: keyName,
        settingValueText: value,
      });
    }
  } catch (error) {
    redirect(withMessage(`/admin/apis/new?provider=${typedProvider}`, friendlyApiError(error)));
  }

  redirect(withMessage(`/admin/apis/${integration.id}`, `${integration.displayName} API saved. You can run a safe connection test now.`));
}

export async function saveApiCredentialAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  try {
    await savePlatformIntegrationCredential(session, {
      integrationId,
      keyName: formData.get("keyName")?.toString(),
      secretValue: formData.get("secretValue")?.toString(),
      isPublicClientValue: checkboxValue(formData, "isPublicClientValue"),
    });
  } catch (error) {
    redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), friendlyApiError(error, "We could not save this credential. Please check the value and try again.")));
  }

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), "Encrypted credential saved. Full secret remains hidden."));
}

export async function saveApiSettingAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  try {
    await savePlatformIntegrationSetting(session, {
      integrationId,
      settingKey: formData.get("settingKey")?.toString(),
      settingValueJson: formData.get("settingValueJson")?.toString(),
      settingValueText: formData.get("settingValueText")?.toString(),
      isSecret: checkboxValue(formData, "isSecret"),
    });
  } catch (error) {
    redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), friendlyApiError(error, "We could not save this setting. Please check the value and try again.")));
  }

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), "API setting saved."));
}

export async function runApiTestAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  try {
    await runPlatformIntegrationTest(session, {
      integrationId,
      testType: formData.get("testType")?.toString() ?? "configuration_check",
    });
  } catch (error) {
    redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), friendlyApiError(error, "We could not run this API test. Please check the saved setup and try again.")));
  }

  redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), "API test logged."));
}

export async function deleteApiIntegrationAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  const confirmation = formData.get("confirmation")?.toString().trim().toUpperCase();

  if (confirmation !== "DELETE") {
    redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), "Type DELETE to delete this API integration."));
  }

  try {
    await deletePlatformIntegration(session, integrationId);
  } catch (error) {
    redirect(withMessage(redirectTarget(formData, `/admin/apis/${integrationId}`), friendlyApiError(error, "We could not delete this API integration. Please refresh the page and try again.")));
  }

  redirect(withMessage("/admin/apis", "API integration deleted."));
}

export async function toggleOAuthSignInAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrationId = formData.get("integrationId")?.toString() ?? "";
  const enabled = formData.get("enabled")?.toString() === "true";

  try {
    await setOAuthIntegrationSignInAvailability(session, integrationId, enabled);
  } catch (error) {
    redirect(withMessage("/admin/apis#social-sign-in", friendlyApiError(error, "We could not update this sign-in option. Please refresh and try again.")));
  }

  redirect(withMessage(
    "/admin/apis#social-sign-in",
    enabled
      ? "Sign-in option enabled. Users can now see this button when the API is configured."
      : "Sign-in option disabled. Users will not see this button.",
  ));
}

export async function importOAuthFromEnvAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const provider = formData.get("provider")?.toString();

  if (provider !== IntegrationProvider.google_oauth && provider !== IntegrationProvider.facebook_oauth) {
    redirect(withMessage("/admin/apis", "Choose Google OAuth or Facebook OAuth to import."));
  }

  let redirectPath = "/admin/apis";
  let message = "Unable to import OAuth settings from environment.";

  try {
    const integration = await importOAuthIntegrationFromEnv(session, provider);
    redirectPath = `/admin/apis/${integration.id}`;
    message = `${integration.displayName} imported from local environment.`;
  } catch (error) {
    message = error instanceof Error ? error.message : message;
  }

  redirect(withMessage(redirectPath, message));
}
