"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  upsertCountryRegionalSetting,
  upsertCurrency,
  upsertFoodTerminologyAlias,
  upsertLocale,
  upsertTranslation,
} from "@/server/localization/localization-service";

function redirectWithMessage(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export async function saveLocaleAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    await upsertLocale(session, formData);
    revalidatePath("/admin/localization");
    revalidatePath("/admin/localization/locales");
    redirectWithMessage("/admin/localization/locales", "Locale saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/localization/locales", getActionErrorMessage(error, "Unable to save locale."));
  }
}

export async function saveTranslationAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    await upsertTranslation(session, formData);
    revalidatePath("/admin/localization/translations");
    redirectWithMessage("/admin/localization/translations", "Translation saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/localization/translations", getActionErrorMessage(error, "Unable to save translation."));
  }
}

export async function saveCurrencyAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    await upsertCurrency(session, formData);
    revalidatePath("/admin/localization");
    revalidatePath("/admin/localization/currencies");
    redirectWithMessage("/admin/localization/currencies", "Currency saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/localization/currencies", getActionErrorMessage(error, "Unable to save currency."));
  }
}

export async function saveCountryRegionalSettingAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    await upsertCountryRegionalSetting(session, formData);
    revalidatePath("/admin/localization/countries");
    revalidatePath("/admin/countries");
    redirectWithMessage("/admin/localization/countries", "Country regional settings saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/localization/countries", getActionErrorMessage(error, "Unable to save country settings."));
  }
}

export async function saveFoodTerminologyAliasAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    await upsertFoodTerminologyAlias(session, formData);
    revalidatePath("/admin/localization/units");
    redirectWithMessage("/admin/localization/units", "Food terminology alias saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/localization/units", getActionErrorMessage(error, "Unable to save terminology alias."));
  }
}
