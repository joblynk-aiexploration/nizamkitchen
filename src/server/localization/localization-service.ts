import type { MeasurementSystem, Prisma } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { assertPlatformRole } from "@/lib/auth";
import { DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT, normalizeDateFormat, normalizeTimeFormat } from "@/lib/date-time-formats";
import { prisma } from "@/lib/prisma";
import { DEFAULT_APP_TIME_ZONE, getTimeZoneOptionsForCountries } from "@/lib/timezones";
import { recordAdminAuditLog } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

const OWNER_ROLES: Array<"platform_owner" | "platform_admin"> = ["platform_owner", "platform_admin"];
const VIEW_ROLES: Array<"platform_owner" | "platform_admin" | "country_manager" | "support_admin" | "auditor"> = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
  "auditor",
];

export const INITIAL_LOCALES = [
  { localeCode: "en-US", languageName: "English (United States)", nativeName: "English", textDirection: "ltr", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "en-US", isDefault: true },
  { localeCode: "en-IN", languageName: "English (India)", nativeName: "English", textDirection: "ltr", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "en-IN", isDefault: false },
  { localeCode: "en-GB", languageName: "English (United Kingdom)", nativeName: "English", textDirection: "ltr", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "en-GB", isDefault: false },
  { localeCode: "ar-SA", languageName: "Arabic (Saudi Arabia)", nativeName: "العربية", textDirection: "rtl", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "ar-SA", isDefault: false },
  { localeCode: "ar-AE", languageName: "Arabic (United Arab Emirates)", nativeName: "العربية", textDirection: "rtl", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "ar-AE", isDefault: false },
  { localeCode: "hi-IN", languageName: "Hindi (India)", nativeName: "हिन्दी", textDirection: "ltr", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "hi-IN", isDefault: false },
  { localeCode: "ur-IN", languageName: "Urdu (India)", nativeName: "اردو", textDirection: "rtl", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "ur-IN", isDefault: false },
  { localeCode: "ur-PK", languageName: "Urdu (Pakistan)", nativeName: "اردو", textDirection: "rtl", dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT, numberFormat: "ur-PK", isDefault: false },
] as const;

export const INITIAL_CURRENCIES = [
  { currencyCode: "USD", displayName: "US Dollar", symbol: "$", decimalDigits: 2, countryCodes: ["US"] },
  { currencyCode: "INR", displayName: "Indian Rupee", symbol: "₹", decimalDigits: 2, countryCodes: ["IN"] },
  { currencyCode: "GBP", displayName: "Pound Sterling", symbol: "£", decimalDigits: 2, countryCodes: ["GB"] },
  { currencyCode: "SAR", displayName: "Saudi Riyal", symbol: "ر.س", decimalDigits: 2, countryCodes: ["SA"] },
  { currencyCode: "AED", displayName: "UAE Dirham", symbol: "د.إ", decimalDigits: 2, countryCodes: ["AE"] },
] as const;

export function parseCsv(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim().toUpperCase() : "")).filter(Boolean)
    : [];
}

export async function listEnabledCountryCurrencyOptions() {
  const [countries, currencies] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      include: { regionalSetting: true },
      orderBy: { countryName: "asc" },
    }),
    prisma.currencySetting.findMany({ where: { status: "active" }, orderBy: { currencyCode: "asc" } }),
  ]);

  const enabledCountryCurrencyCodes = new Set<string>();
  for (const country of countries) {
    const regionalCurrencies = jsonStringArray(country.regionalSetting?.supportedCurrencyCodesJson);
    const codes = regionalCurrencies.length ? regionalCurrencies : [country.currencyCode];
    for (const code of codes) {
      enabledCountryCurrencyCodes.add(code.trim().toUpperCase());
    }
  }

  if (!enabledCountryCurrencyCodes.size) {
    return currencies;
  }

  return currencies.filter((currency) => enabledCountryCurrencyCodes.has(currency.currencyCode));
}

export async function listEnabledCountryTimeZoneOptions() {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
  });

  return getTimeZoneOptionsForCountries(countries);
}

export async function listEnabledCountryPhoneOptions() {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
    select: { countryCode: true, countryName: true, phoneCountryCode: true },
  });

  return countries.map((country) => ({
    countryCode: country.countryCode,
    countryName: country.countryName,
    phoneCountryCode: country.phoneCountryCode.startsWith("+")
      ? country.phoneCountryCode
      : `+${country.phoneCountryCode.replace(/\D/g, "")}`,
  }));
}

function displayLanguageName(locale: { languageName: string; nativeName?: string | null; localeCode: string }) {
  return locale.languageName.replace(/\s*\([^)]*\)\s*$/, "").trim() || locale.localeCode.split("-")[0];
}

export async function listEnabledLanguageOptions() {
  const locales = await prisma.localizationLocale.findMany({
    where: { status: "active" },
    orderBy: [{ isDefault: "desc" }, { languageName: "asc" }, { localeCode: "asc" }],
  });
  const seen = new Set<string>();

  return locales
    .map((locale) => {
      const languageName = displayLanguageName(locale);
      return {
        value: languageName,
        label: locale.nativeName && locale.nativeName !== languageName
          ? `${languageName} - ${locale.nativeName}`
          : languageName,
        localeCode: locale.localeCode,
      };
    })
    .filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
}

export async function listLocalizationDashboard(session: Session) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const countryCodes = session.countryAssignments.map((assignment) => assignment.countryCode);

  const countryWhere = isCountryManager ? { countryCode: { in: countryCodes } } : {};

  const [locales, currencies, countries, translations, aliases] = await Promise.all([
    prisma.localizationLocale.findMany({ orderBy: [{ isDefault: "desc" }, { localeCode: "asc" }] }),
    prisma.currencySetting.findMany({ orderBy: { currencyCode: "asc" } }),
    prisma.country.findMany({ where: countryWhere, include: { regionalSetting: true }, orderBy: { countryName: "asc" } }),
    prisma.localizationTranslation.findMany({ orderBy: [{ namespace: "asc" }, { translationKey: "asc" }], take: 250 }),
    prisma.foodTerminologyAlias.findMany({
      include: { ingredient: true, locale: true },
      orderBy: [{ sourceTerm: "asc" }, { localizedTerm: "asc" }],
      take: 250,
    }),
  ]);

  return { locales, currencies, countries, translations, aliases };
}

export async function upsertLocale(session: Session, formData: FormData) {
  assertPlatformRole(session.user.platformRole, OWNER_ROLES);
  const localeCode = String(formData.get("localeCode") ?? "").trim();
  if (!localeCode) throw new Error("Locale code is required.");

  const data = {
    languageName: String(formData.get("languageName") ?? "").trim(),
    nativeName: String(formData.get("nativeName") ?? "").trim(),
    textDirection: String(formData.get("textDirection") ?? "ltr") === "rtl" ? "rtl" : "ltr",
    status: formData.get("status") === "disabled" ? "disabled" : "active",
    isDefault: formData.get("isDefault") === "on",
    dateFormat: normalizeDateFormat(formData.get("dateFormat")),
    timeFormat: normalizeTimeFormat(),
    numberFormat: String(formData.get("numberFormat") ?? localeCode).trim(),
    updatedById: session.user.id,
  } satisfies Prisma.LocalizationLocaleUpdateInput;

  const locale = await prisma.localizationLocale.upsert({
    where: { localeCode },
    create: { localeCode, ...data, createdById: session.user.id },
    update: data,
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "localization_locale.upserted",
    targetType: "localization_locale",
    targetId: locale.localeCode,
    details: { localeCode, status: locale.status, textDirection: locale.textDirection },
  });

  return locale;
}

export async function upsertCurrency(session: Session, formData: FormData) {
  assertPlatformRole(session.user.platformRole, OWNER_ROLES);
  const currencyCode = String(formData.get("currencyCode") ?? "").trim().toUpperCase();
  if (currencyCode.length !== 3) throw new Error("Currency code must be a 3-letter ISO code.");

  const data = {
    displayName: String(formData.get("displayName") ?? "").trim(),
    symbol: String(formData.get("symbol") ?? currencyCode).trim(),
    decimalDigits: Number(formData.get("decimalDigits") ?? 2),
    status: formData.get("status") === "disabled" ? "disabled" : "active",
    countryCodesJson: parseCsv(formData.get("countryCodes")) as Prisma.InputJsonValue,
    updatedById: session.user.id,
  } satisfies Prisma.CurrencySettingUpdateInput;

  const currency = await prisma.currencySetting.upsert({
    where: { currencyCode },
    create: { currencyCode, ...data, createdById: session.user.id },
    update: data,
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "currency_setting.upserted",
    targetType: "currency_setting",
    targetId: currency.currencyCode,
    details: { currencyCode, status: currency.status },
  });

  return currency;
}

export async function upsertTranslation(session: Session, formData: FormData) {
  assertPlatformRole(session.user.platformRole, OWNER_ROLES);
  const localeCode = String(formData.get("localeCode") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "common").trim();
  const translationKey = String(formData.get("translationKey") ?? "").trim();
  if (!localeCode || !namespace || !translationKey) throw new Error("Locale, namespace, and key are required.");

  const data = {
    defaultValue: String(formData.get("defaultValue") ?? "").trim(),
    translatedValue: String(formData.get("translatedValue") ?? "").trim(),
    status: formData.get("status") === "draft" ? "draft" : formData.get("status") === "disabled" ? "disabled" : "published",
    updatedById: session.user.id,
  } satisfies Prisma.LocalizationTranslationUpdateInput;

  const translation = await prisma.localizationTranslation.upsert({
    where: { localeCode_namespace_translationKey: { localeCode, namespace, translationKey } },
    create: { localeCode, namespace, translationKey, ...data, createdById: session.user.id },
    update: data,
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "localization_translation.upserted",
    targetType: "localization_translation",
    targetId: translation.id,
    details: { localeCode, namespace, translationKey },
  });

  return translation;
}

export async function upsertCountryRegionalSetting(session: Session, formData: FormData) {
  assertPlatformRole(session.user.platformRole, OWNER_ROLES);
  const countryCode = String(formData.get("countryCode") ?? "").trim().toUpperCase();
  if (!countryCode) throw new Error("Country code is required.");

  const measurementSystem = String(formData.get("measurementSystem") ?? "metric") as MeasurementSystem;
  const supportedLocales = parseCsv(formData.get("supportedLocales"));
  const supportedCurrencies = parseCsv(formData.get("supportedCurrencyCodes")).map((code) => code.toUpperCase());
  const addressLines = parseCsv(formData.get("addressFormat"));

  const data = {
    defaultLocale: String(formData.get("defaultLocale") ?? "en-US").trim(),
    supportedLocalesJson: supportedLocales as Prisma.InputJsonValue,
    supportedCurrencyCodesJson: supportedCurrencies as Prisma.InputJsonValue,
    measurementSystem,
    dateFormat: normalizeDateFormat(formData.get("dateFormat")),
    timeFormat: normalizeTimeFormat(),
    addressFormatJson: addressLines as Prisma.InputJsonValue,
    rtlEnabled: formData.get("rtlEnabled") === "on",
    updatedById: session.user.id,
  } satisfies Prisma.CountryRegionalSettingUpdateInput;

  const regionalSetting = await prisma.countryRegionalSetting.upsert({
    where: { countryCode },
    create: { countryCode, ...data, createdById: session.user.id },
    update: data,
  });

  await prisma.country.update({
    where: { countryCode },
    data: {
      defaultLocale: regionalSetting.defaultLocale,
      measurementSystem: regionalSetting.measurementSystem,
      currencyCode: supportedCurrencies[0] ?? undefined,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    countryCode,
    action: "country_regional_setting.upserted",
    targetType: "country_regional_setting",
    targetId: countryCode,
    details: { supportedLocales, supportedCurrencies },
  });

  return regionalSetting;
}

export async function upsertFoodTerminologyAlias(session: Session, formData: FormData) {
  assertPlatformRole(session.user.platformRole, OWNER_ROLES);
  const sourceTerm = String(formData.get("sourceTerm") ?? "").trim();
  const localizedTerm = String(formData.get("localizedTerm") ?? "").trim();
  if (!sourceTerm || !localizedTerm) throw new Error("Source and localized terms are required.");

  const alias = await prisma.foodTerminologyAlias.create({
    data: {
      localeCode: String(formData.get("localeCode") ?? "").trim() || null,
      countryCode: String(formData.get("countryCode") ?? "").trim().toUpperCase() || null,
      ingredientId: String(formData.get("ingredientId") ?? "").trim() || null,
      sourceTerm,
      localizedTerm,
      transliteration: String(formData.get("transliteration") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    countryCode: alias.countryCode,
    action: "food_terminology_alias.created",
    targetType: "food_terminology_alias",
    targetId: alias.id,
    details: { sourceTerm, localizedTerm, localeCode: alias.localeCode },
  });

  return alias;
}

export async function getUserLocalizationPreferences(session: Session) {
  const [preference, locales, currencies, timeZones] = await Promise.all([
    prisma.userLocalizationPreference.findUnique({ where: { userId: session.user.id } }),
    prisma.localizationLocale.findMany({ where: { status: "active" }, orderBy: [{ isDefault: "desc" }, { localeCode: "asc" }] }),
    listEnabledCountryCurrencyOptions(),
    listEnabledCountryTimeZoneOptions(),
  ]);

  return { preference, locales, currencies, timeZones };
}

export async function updateUserLocalizationPreferences(session: Session, formData: FormData) {
  const localeCode = String(formData.get("localeCode") ?? session.user.preferredLocale ?? "en-US").trim();
  const timezone = String(formData.get("timezone") ?? session.user.preferredTimezone ?? DEFAULT_APP_TIME_ZONE).trim();
  const currencyCode = String(formData.get("currencyCode") ?? "").trim().toUpperCase() || null;
  const measurementSystem = String(formData.get("measurementSystem") ?? "") as MeasurementSystem | "";
  const [enabledTimeZones, activeLocales] = await Promise.all([
    listEnabledCountryTimeZoneOptions(),
    prisma.localizationLocale.findMany({ where: { status: "active" }, orderBy: [{ isDefault: "desc" }, { localeCode: "asc" }] }),
  ]);
  const enabledTimeZoneValues = new Set(enabledTimeZones.map((timeZone) => timeZone.value));
  if (enabledTimeZoneValues.size > 0 && !enabledTimeZoneValues.has(timezone)) {
    throw new Error("Choose a timezone supported by an enabled country.");
  }

  const selectedLocale = activeLocales.find((locale) => locale.localeCode === localeCode);
  if (activeLocales.length > 0 && !selectedLocale) {
    throw new Error("Choose a supported language.");
  }

  const enabledCurrencies = await listEnabledCountryCurrencyOptions();
  const enabledCurrencyCodes = new Set(enabledCurrencies.map((currency) => currency.currencyCode));
  if (currencyCode && enabledCurrencyCodes.size > 0 && !enabledCurrencyCodes.has(currencyCode)) {
    throw new Error("Choose a currency supported by an enabled country.");
  }

  const preference = await prisma.userLocalizationPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      localeCode,
      timezone,
      currencyCode,
      measurementSystem: measurementSystem || null,
      dateFormat: normalizeDateFormat(formData.get("dateFormat")),
      timeFormat: normalizeTimeFormat(),
    },
    update: {
      localeCode,
      timezone,
      currencyCode,
      measurementSystem: measurementSystem || null,
      dateFormat: normalizeDateFormat(formData.get("dateFormat")),
      timeFormat: normalizeTimeFormat(),
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      preferredLocale: localeCode,
      preferredLanguage: selectedLocale ? displayLanguageName(selectedLocale) : localeCode.split("-")[0],
      preferredTimezone: timezone,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "user.localization_preferences.updated",
    targetType: "user",
    targetId: session.user.id,
    details: { localeCode, timezone, currencyCode },
  });

  return preference;
}
