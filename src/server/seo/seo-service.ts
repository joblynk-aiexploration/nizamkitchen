import type { Metadata } from "next";
import { IntegrationProvider, Prisma, RobotsDirective, SeoScope, type SeoSetting } from "@prisma/client";
import { shouldSkipBuildTimeDatabase } from "@/lib/build-phase";
import { COOKIE_PRIVACY_CONSENT_FEATURE_FLAG, isGlobalFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { getActiveIntegration, getPublicIntegrationConfig } from "@/server/config/platform-config-service";

const DEFAULT_SITE_URL = "https://nizamkitchen.com";
const DEFAULT_TITLE = "NizamKitchen";
const DEFAULT_DESCRIPTION = "Hyderabadi meal planning, grocery lists, home chefs, catering, restaurants, and food marketplace workflows.";
const DEFAULT_GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-D2668ZZ80C";

export type SeoFormInput = {
  id?: string;
  scope: SeoScope;
  entityType?: string | null;
  entityId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  path?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageFileId?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImageFileId?: string | null;
  robotsDirective?: RobotsDirective | null;
  structuredDataJson?: Prisma.InputJsonValue | null;
  aeoSummary?: string | null;
  aeoFaqJson?: Prisma.InputJsonValue | null;
  isActive?: boolean;
  actorUserId: string;
};

export type GooglePlatformPublicConfig = {
  searchConsoleVerification?: string;
  analyticsMeasurementId?: string;
  analyticsEnabled: boolean;
  analyticsConsentRequired: boolean;
  consentManagementEnabled: boolean;
  consentModeEnabled: boolean;
  cmpAnalyticsIntegrationEnabled: boolean;
  adsensePublisherId?: string;
  adsenseEnabled: boolean;
  adsTxtLine?: string;
};

export type SecurePrivacyPublicConfig = {
  enabled: boolean;
  scriptUrl?: string;
  consentModeEnabled: boolean;
  googleAnalyticsIntegrationEnabled: boolean;
};

export function siteUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || DEFAULT_SITE_URL;
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePath(path?: string | null) {
  const value = clean(path);
  if (!value) return null;
  return value.startsWith("/") ? value : `/${value}`;
}

export function robotsToMetadata(directive?: RobotsDirective | null): Metadata["robots"] {
  switch (directive) {
    case RobotsDirective.noindex_follow:
      return { index: false, follow: true };
    case RobotsDirective.noindex_nofollow:
      return { index: false, follow: false };
    case RobotsDirective.index_nofollow:
      return { index: true, follow: false };
    case RobotsDirective.index_follow:
    default:
      return { index: true, follow: true };
  }
}

export async function listSeoSettings(filter?: { scope?: SeoScope; activeOnly?: boolean }) {
  return prisma.seoSetting.findMany({
    where: {
      scope: filter?.scope,
      isActive: filter?.activeOnly ? true : undefined,
    },
    orderBy: [{ scope: "asc" }, { path: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getSeoSetting(id: string) {
  return prisma.seoSetting.findUnique({ where: { id } });
}

export async function saveSeoSetting(input: SeoFormInput) {
  const data = {
    scope: input.scope,
    entityType: clean(input.entityType),
    entityId: clean(input.entityId),
    countryCode: clean(input.countryCode)?.toUpperCase() ?? null,
    city: clean(input.city),
    path: normalizePath(input.path),
    metaTitle: clean(input.metaTitle),
    metaDescription: clean(input.metaDescription),
    canonicalUrl: clean(input.canonicalUrl),
    ogTitle: clean(input.ogTitle),
    ogDescription: clean(input.ogDescription),
    ogImageFileId: clean(input.ogImageFileId),
    twitterTitle: clean(input.twitterTitle),
    twitterDescription: clean(input.twitterDescription),
    twitterImageFileId: clean(input.twitterImageFileId),
    robotsDirective: input.robotsDirective,
    structuredDataJson: input.structuredDataJson ?? Prisma.JsonNull,
    aeoSummary: clean(input.aeoSummary),
    aeoFaqJson: input.aeoFaqJson ?? Prisma.JsonNull,
    isActive: input.isActive ?? true,
    updatedById: input.actorUserId,
  };

  if (input.id) {
    return prisma.seoSetting.update({
      where: { id: input.id },
      data,
    });
  }

  return prisma.seoSetting.create({
    data: {
      ...data,
      createdById: input.actorUserId,
    },
  });
}

export async function findEffectiveSeoSetting(input: {
  path?: string;
  scope?: SeoScope;
  entityType?: string;
  entityId?: string;
  countryCode?: string;
  city?: string;
}) {
  if (shouldSkipBuildTimeDatabase()) return null;

  const path = normalizePath(input.path);
  const countryCode = clean(input.countryCode)?.toUpperCase();
  const city = clean(input.city);
  const candidates: SeoSetting[] = [];

  try {
    if (input.entityId && input.scope) {
      const entitySetting = await prisma.seoSetting.findFirst({
        where: {
          scope: input.scope,
          entityType: input.entityType,
          entityId: input.entityId,
          isActive: true,
        },
        orderBy: { updatedAt: "desc" },
      });
      if (entitySetting) candidates.push(entitySetting);
    }

    if (path) {
      const pageSetting = await prisma.seoSetting.findFirst({
        where: { path, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      if (pageSetting) candidates.push(pageSetting);
    }

    if (city || countryCode) {
      const localSetting = await prisma.seoSetting.findFirst({
        where: {
          isActive: true,
          city: city ?? undefined,
          countryCode: countryCode ?? undefined,
        },
        orderBy: [{ city: "desc" }, { countryCode: "desc" }, { updatedAt: "desc" }],
      });
      if (localSetting) candidates.push(localSetting);
    }

    const globalSetting = await prisma.seoSetting.findFirst({
      where: { scope: SeoScope.global, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (globalSetting) candidates.push(globalSetting);
  } catch {
    return null;
  }

  return candidates[0] ?? null;
}

export async function buildSeoMetadata(input: {
  path?: string;
  title?: string;
  description?: string;
  scope?: SeoScope;
  entityType?: string;
  entityId?: string;
  countryCode?: string;
  city?: string;
} = {}): Promise<Metadata> {
  const setting = await findEffectiveSeoSetting(input);
  const title = setting?.metaTitle ?? input.title ?? DEFAULT_TITLE;
  const description = setting?.metaDescription ?? input.description ?? DEFAULT_DESCRIPTION;
  const canonical = setting?.canonicalUrl ?? siteUrl(input.path ?? setting?.path ?? "/");
  const ogTitle = setting?.ogTitle ?? title;
  const ogDescription = setting?.ogDescription ?? description;
  const twitterTitle = setting?.twitterTitle ?? ogTitle;
  const twitterDescription = setting?.twitterDescription ?? ogDescription;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: "NizamKitchen",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: twitterTitle,
      description: twitterDescription,
    },
    robots: robotsToMetadata(setting?.robotsDirective),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NizamKitchen",
    url: siteUrl("/"),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "NizamKitchen",
    url: siteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl("/recipes")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function faqJsonLd(faqJson: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(faqJson) || faqJson.length === 0) return null;
  const mainEntity = faqJson
    .filter((item): item is { question: string; answer: string } =>
      Boolean(item && typeof item === "object" && "question" in item && "answer" in item),
    )
    .map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    }));

  if (mainEntity.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

export function recipeJsonLd(recipe: {
  name: string;
  description?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  servings?: number | null;
  ingredients?: Array<{ ingredient?: { name?: string | null }; displayName?: string | null; quantity?: number | null }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name,
    description: recipe.description ?? undefined,
    recipeYield: recipe.servings ? `${recipe.servings} servings` : undefined,
    prepTime: recipe.prepMinutes ? `PT${recipe.prepMinutes}M` : undefined,
    cookTime: recipe.cookMinutes ? `PT${recipe.cookMinutes}M` : undefined,
    recipeIngredient: recipe.ingredients?.map((item) => item.displayName ?? item.ingredient?.name).filter(Boolean),
  };
}

export function localBusinessJsonLd(profile: {
  displayName: string;
  slug: string;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  description?: string | null;
  urlPath: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.displayName,
    description: profile.description ?? undefined,
    url: siteUrl(profile.urlPath),
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.city ?? undefined,
      addressRegion: profile.region ?? undefined,
      addressCountry: profile.countryCode ?? undefined,
    },
  };
}

function settingValue(integration: Awaited<ReturnType<typeof getActiveIntegration>>, key: string) {
  return integration?.settings.find((setting) => setting.settingKey === key)?.settingValueJson;
}

function credentialValue(integration: Awaited<ReturnType<typeof getActiveIntegration>>, key: string) {
  return integration?.credentials.find((credential) => credential.keyName === key)?.value;
}

function normalizeGoogleAnalyticsMeasurementId(value?: string | null) {
  const measurementId = value?.trim();
  if (!measurementId) return undefined;
  return /^G-[A-Z0-9]+$/i.test(measurementId) ? measurementId.toUpperCase() : undefined;
}

function googleAnalyticsMeasurementIdFromEnv() {
  return normalizeGoogleAnalyticsMeasurementId(
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || DEFAULT_GOOGLE_ANALYTICS_MEASUREMENT_ID,
  );
}

function googlePlatformConfigFallback(): GooglePlatformPublicConfig {
  const analyticsMeasurementId = googleAnalyticsMeasurementIdFromEnv();
  return {
    analyticsMeasurementId,
    analyticsEnabled: Boolean(analyticsMeasurementId),
    analyticsConsentRequired: true,
    consentManagementEnabled: true,
    consentModeEnabled: false,
    cmpAnalyticsIntegrationEnabled: false,
    adsenseEnabled: false,
  };
}

async function cookiePrivacyConsentEnabled(defaultEnabled = true) {
  if (shouldSkipBuildTimeDatabase()) return defaultEnabled;
  return isGlobalFeatureEnabled(COOKIE_PRIVACY_CONSENT_FEATURE_FLAG, defaultEnabled);
}

function securePrivacyScriptUrl(value: unknown) {
  if (typeof value !== "string") return undefined;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return undefined;
    if (parsed.hostname !== "app.secureprivacy.ai") return undefined;
    if (!parsed.pathname.startsWith("/script/") || !parsed.pathname.endsWith(".js")) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export async function getSecurePrivacyPublicConfig(): Promise<SecurePrivacyPublicConfig> {
  if (!(await cookiePrivacyConsentEnabled(true))) {
    return {
      enabled: false,
      scriptUrl: undefined,
      consentModeEnabled: false,
      googleAnalyticsIntegrationEnabled: false,
    };
  }

  const fallbackConfig: SecurePrivacyPublicConfig = {
    enabled: false,
    scriptUrl: undefined,
    consentModeEnabled: false,
    googleAnalyticsIntegrationEnabled: false,
  };

  if (shouldSkipBuildTimeDatabase()) {
    return fallbackConfig;
  }

  try {
    const integration = await getPublicIntegrationConfig(IntegrationProvider.secure_privacy);
    if (!integration) return fallbackConfig;

    const scriptUrl = securePrivacyScriptUrl(integration?.settings.scriptUrl);
    const enabled = Boolean(scriptUrl);
    return {
      enabled,
      scriptUrl,
      consentModeEnabled: enabled && settingToBoolean(integration?.settings.consentModeEnabled, true),
      googleAnalyticsIntegrationEnabled: enabled && (
        settingToBoolean(integration?.settings.googleAnalyticsConsentEnabled, false) ||
        settingToBoolean(integration?.settings.googleAnalyticsIntegrationEnabled, true)
      ),
    };
  } catch {
    return fallbackConfig;
  }
}

export async function getGooglePlatformPublicConfig(): Promise<GooglePlatformPublicConfig> {
  if (shouldSkipBuildTimeDatabase()) {
    return googlePlatformConfigFallback();
  }

  let searchConsole: Awaited<ReturnType<typeof getPublicIntegrationConfig>>;
  let analytics: Awaited<ReturnType<typeof getPublicIntegrationConfig>>;
  let adsense: Awaited<ReturnType<typeof getPublicIntegrationConfig>>;
  let securePrivacy: SecurePrivacyPublicConfig;
  let cookieConsentEnabled: boolean;

  try {
    [searchConsole, analytics, adsense, securePrivacy, cookieConsentEnabled] = await Promise.all([
      getPublicIntegrationConfig(IntegrationProvider.google_search_console),
      getPublicIntegrationConfig(IntegrationProvider.google_analytics),
      getPublicIntegrationConfig(IntegrationProvider.google_adsense),
      getSecurePrivacyPublicConfig(),
      cookiePrivacyConsentEnabled(true),
    ]);
  } catch {
    return googlePlatformConfigFallback();
  }

  const searchConsoleMeta = searchConsole?.credentials.verification_meta_tag ?? searchConsole?.credentials.verification_html_token;
  if (!cookieConsentEnabled) {
    return {
      searchConsoleVerification: typeof searchConsoleMeta === "string" ? extractGoogleVerificationContent(searchConsoleMeta) : undefined,
      analyticsEnabled: false,
      analyticsConsentRequired: false,
      consentManagementEnabled: false,
      consentModeEnabled: false,
      cmpAnalyticsIntegrationEnabled: false,
      adsenseEnabled: false,
    };
  }

  const analyticsCredentialMeasurementId = normalizeGoogleAnalyticsMeasurementId(
    typeof analytics?.credentials.measurement_id === "string" ? analytics.credentials.measurement_id : undefined,
  );
  const analyticsMeasurementId = analyticsCredentialMeasurementId ?? googleAnalyticsMeasurementIdFromEnv();
  const adsensePublisherId = adsense?.credentials.publisher_id;

  return {
    searchConsoleVerification: typeof searchConsoleMeta === "string" ? extractGoogleVerificationContent(searchConsoleMeta) : undefined,
    analyticsMeasurementId,
    analyticsEnabled: Boolean(analyticsMeasurementId),
    analyticsConsentRequired: true,
    consentManagementEnabled: true,
    consentModeEnabled: securePrivacy.consentModeEnabled,
    cmpAnalyticsIntegrationEnabled: securePrivacy.googleAnalyticsIntegrationEnabled,
    adsensePublisherId: typeof adsensePublisherId === "string" ? adsensePublisherId : undefined,
    adsenseEnabled: Boolean(adsense && adsensePublisherId && settingToBoolean(adsense.settings.publicAdScriptEnabled, false)),
    adsTxtLine: typeof adsense?.settings.adsTxtLine === "string" ? adsense.settings.adsTxtLine : undefined,
  };
}

export async function getRecaptchaConfig(countryCode?: string | null) {
  const integration = await getActiveIntegration(IntegrationProvider.google_recaptcha, countryCode);
  if (!integration) return null;
  return {
    siteKey: credentialValue(integration, "site_key"),
    secretKey: credentialValue(integration, "secret_key"),
    version: settingValue(integration, "version") ?? "v3",
    scoreThreshold: Number(settingValue(integration, "scoreThreshold") ?? 0.5),
    enabledPages: String(settingValue(integration, "enabledPages") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  };
}

export async function verifyRecaptcha(input: { token?: string | null; page: string; ip?: string | null; countryCode?: string | null }) {
  const config = await getRecaptchaConfig(input.countryCode);
  if (!config?.secretKey) {
    return { ok: true, skipped: true, reason: "reCAPTCHA is not configured." };
  }

  if (config.enabledPages.length > 0 && !config.enabledPages.includes(input.page)) {
    return { ok: true, skipped: true, reason: "reCAPTCHA is disabled for this page." };
  }

  if (!input.token) {
    return { ok: false, skipped: false, reason: "Please complete the verification challenge." };
  }

  const body = new URLSearchParams({ secret: config.secretKey, response: input.token });
  if (input.ip) body.set("remoteip", input.ip);
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body,
  });
  const json = await response.json() as { success?: boolean; score?: number };
  const scoreOk = typeof json.score === "number" ? json.score >= config.scoreThreshold : true;
  return {
    ok: Boolean(json.success && scoreOk),
    skipped: false,
    reason: json.success ? "reCAPTCHA verified." : "Verification failed. Please try again.",
  };
}

function settingToBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

export function extractGoogleVerificationContent(value: string) {
  const match = value.match(/content=["']([^"']+)["']/i);
  return match?.[1] ?? value.trim();
}
