import {
  IntegrationCategory,
  IntegrationEnvironment,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationTestStatus,
  type PlatformIntegration,
  type PlatformRole,
  type Prisma,
  type UserStatus,
} from "@prisma/client";
import { getOAuthCallbackPath, getOAuthCallbackUrl, isLocalhostUrl, isProductionRuntime } from "@/lib/app-url";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  providerRequiredCredentialKeys,
  providerRequiredSettingKeys,
} from "@/lib/integrations/provider-fields";
import { prisma } from "@/lib/prisma";
import {
  normalizeSettingValue,
  platformIntegrationCredentialSchema,
  platformIntegrationSchema,
  platformIntegrationSettingSchema,
  platformIntegrationTestSchema,
} from "@/lib/validation/platform-config";
import { createAuditEvent } from "@/server/audit";
import { loadNodemailer } from "@/server/email/nodemailer-loader";
import {
  decryptGatewayCredential,
  encryptGatewayCredential,
  isPaymentEncryptionConfigured,
  maskCredentialPreview,
} from "@/server/payments/credentials";

type AdminSession = {
  user: { id: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments?: Array<{ countryCode: string }>;
};

type IntegrationTemplate = {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  displayName: string;
  description: string;
  publicCredentialKeys: string[];
  serverCredentialKeys: string[];
  settings: Array<{ key: string; description: string; example?: string }>;
  supportedTestTypes: string[];
};

const VIEW_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];
const MANAGE_ROLES: PlatformRole[] = ["platform_owner"];
const SECRET_ROLES: PlatformRole[] = ["platform_owner"];

const INTEGRATION_TEMPLATES: Record<IntegrationProvider, IntegrationTemplate> = {
  google_maps: {
    provider: "google_maps",
    category: "maps",
    displayName: "Google Maps",
    description: "Browser and server map configuration, allowed countries, and map defaults.",
    publicCredentialKeys: ["browser_api_key"],
    serverCredentialKeys: ["server_api_key"],
    settings: [
      { key: "allowedCountries", description: "Comma-separated allowed country codes.", example: "US,CA,AE" },
      { key: "enabledApis", description: "Enabled API names.", example: "maps,javascript" },
      { key: "defaultMapCenter", description: "Default center JSON.", example: "{\"lat\":17.385,\"lng\":78.4867}" },
      { key: "defaultRadiusMeters", description: "Default search radius.", example: "5000" },
      { key: "locationTrackingEnabled", description: "Allow location tracking toggle.", example: "false" },
    ],
    supportedTestTypes: ["maps_key", "places_search"],
  },
  google_places: {
    provider: "google_places",
    category: "maps",
    displayName: "Google Places",
    description: "Places and autocomplete lookups for seller and restaurant discovery.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["server_api_key"],
    settings: [{ key: "allowedCountries", description: "Restrict places requests by country.", example: "US,IN" }],
    supportedTestTypes: ["places_search"],
  },
  google_geocoding: {
    provider: "google_geocoding",
    category: "maps",
    displayName: "Google Geocoding",
    description: "Server geocoding for address normalization and search.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["server_api_key"],
    settings: [{ key: "allowedCountries", description: "Optional country restrictions.", example: "US,AE" }],
    supportedTestTypes: ["geocoding"],
  },
  google_oauth: {
    provider: "google_oauth",
    category: "auth",
    displayName: "Google OAuth",
    description: "OAuth client credentials, callback URLs, and optional domain restrictions.",
    publicCredentialKeys: ["client_id"],
    serverCredentialKeys: ["client_secret"],
    settings: [
      { key: "callbackUrl", description: "OAuth callback URL.", example: "https://app.example.com/api/auth/oauth/google/callback" },
      { key: "allowedDomains", description: "Optional allowed email domains.", example: "example.com" },
      { key: "autoCreateUser", description: "Allow new users to create an account with Google.", example: "true" },
      { key: "defaultOrganizationType", description: "Default onboarding account type.", example: "household" },
      { key: "loginButtonVisible", description: "Show the Google button on public auth pages.", example: "true" },
    ],
    supportedTestTypes: ["oauth_config"],
  },
  facebook_oauth: {
    provider: "facebook_oauth",
    category: "auth",
    displayName: "Facebook OAuth",
    description: "Facebook app credentials and callback configuration.",
    publicCredentialKeys: ["app_id"],
    serverCredentialKeys: ["app_secret"],
    settings: [
      { key: "callbackUrl", description: "OAuth callback URL.", example: "https://app.example.com/api/auth/oauth/facebook/callback" },
      { key: "autoCreateUser", description: "Allow new users to create an account with Facebook.", example: "true" },
      { key: "defaultOrganizationType", description: "Default onboarding account type.", example: "household" },
      { key: "loginButtonVisible", description: "Show the Facebook button on public auth pages.", example: "true" },
    ],
    supportedTestTypes: ["oauth_config"],
  },
  google_analytics: {
    provider: "google_analytics",
    category: "analytics",
    displayName: "Google Analytics",
    description: "Measurement ID and consent configuration for analytics.",
    publicCredentialKeys: ["measurement_id"],
    serverCredentialKeys: [],
    settings: [
      { key: "consentMode", description: "Consent mode placeholder.", example: "granted" },
      { key: "consentRequired", description: "Only render analytics after user consent.", example: "true" },
      { key: "trackPageViews", description: "Track public page views when enabled.", example: "true" },
      { key: "trackEvents", description: "Comma-separated event names such as sign_up, login, view_recipe, search, create_meal_plan, generate_grocery_list, order_request_submitted, seller_profile_viewed.", example: "sign_up,login,view_recipe" },
      { key: "serverSideMeasurementEnabled", description: "Server-side measurement placeholder.", example: "false" },
    ],
    supportedTestTypes: ["analytics_config"],
  },
  secure_privacy: {
    provider: "secure_privacy",
    category: "consent",
    displayName: "Secure Privacy CMP",
    description: "Secure Privacy cookie consent banner and Google Consent Mode controls.",
    publicCredentialKeys: [],
    serverCredentialKeys: [],
    settings: [
      { key: "scriptUrl", description: "Secure Privacy banner script URL.", example: "https://app.secureprivacy.ai/script/6a265d6522609752e3d645f1.js" },
      { key: "consentModeEnabled", description: "Set Google Consent Mode defaults before Analytics loads.", example: "true" },
      { key: "googleAnalyticsConsentEnabled", description: "Allow Google Analytics tracking only after Secure Privacy analytics consent.", example: "true" },
      { key: "googleAnalyticsIntegrationEnabled", description: "Legacy alias for Google Analytics consent integration.", example: "true" },
    ],
    supportedTestTypes: ["cmp_config"],
  },
  google_search_console: {
    provider: "google_search_console",
    category: "seo",
    displayName: "Google Search Console",
    description: "Verification tokens and site property configuration.",
    publicCredentialKeys: ["verification_meta_tag", "verification_html_token"],
    serverCredentialKeys: [],
    settings: [{ key: "sitePropertyUrl", description: "Verified site property URL.", example: "https://nizamkitchen.com" }],
    supportedTestTypes: ["search_console"],
  },
  google_recaptcha: {
    provider: "google_recaptcha",
    category: "security",
    displayName: "Google reCAPTCHA",
    description: "Site and secret keys with page targeting and score thresholds.",
    publicCredentialKeys: ["site_key"],
    serverCredentialKeys: ["secret_key"],
    settings: [
      { key: "version", description: "reCAPTCHA version.", example: "v3" },
      { key: "scoreThreshold", description: "Score threshold.", example: "0.5" },
      { key: "enabledPages", description: "Pages protected by reCAPTCHA.", example: "login,register,contact" },
    ],
    supportedTestTypes: ["recaptcha_verify"],
  },
  google_adsense: {
    provider: "google_adsense",
    category: "ads",
    displayName: "Google AdSense",
    description: "Publisher ID and ad script controls.",
    publicCredentialKeys: ["publisher_id"],
    serverCredentialKeys: [],
    settings: [
      { key: "adsTxtEnabled", description: "ads.txt management enabled.", example: "false" },
      { key: "adsTxtLine", description: "Full ads.txt publisher line.", example: "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0" },
      { key: "publicAdScriptEnabled", description: "Expose public ad script.", example: "false" },
      { key: "autoAdsEnabled", description: "Enable auto ads script behavior.", example: "false" },
    ],
    supportedTestTypes: ["adsense_config"],
  },
  youtube_data: {
    provider: "youtube_data",
    category: "marketplace",
    displayName: "YouTube Data API",
    description: "Server API key and discovery controls for verified recipe video references.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["server_api_key"],
    settings: [{ key: "discoveryEnabled", description: "Enable recipe video discovery.", example: "true" }],
    supportedTestTypes: ["youtube_key"],
  },
  aws_s3: {
    provider: "aws_s3",
    category: "storage",
    displayName: "AWS S3",
    description: "Bucket, region, and credential settings for production object storage.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["access_key_id", "secret_access_key", "session_token"],
    settings: [
      { key: "bucketName", description: "Bucket name.", example: "nizamkitchen-prod" },
      { key: "region", description: "AWS region.", example: "us-east-1" },
      { key: "endpoint", description: "Optional custom endpoint.", example: "https://s3.us-east-1.amazonaws.com" },
    ],
    supportedTestTypes: ["s3_connection"],
  },
  s3_compatible: {
    provider: "s3_compatible",
    category: "storage",
    displayName: "S3-Compatible Storage",
    description: "Endpoint, bucket, and credential settings for S3-compatible object storage.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["access_key_id", "secret_access_key", "session_token"],
    settings: [
      { key: "bucketName", description: "Bucket name.", example: "nizamkitchen-prod" },
      { key: "region", description: "Region or compatibility region.", example: "auto" },
      { key: "endpoint", description: "S3-compatible endpoint.", example: "https://storage.example.com" },
      { key: "forcePathStyle", description: "Use path-style bucket addressing.", example: "true" },
    ],
    supportedTestTypes: ["s3_connection"],
  },
  smtp: {
    provider: "smtp",
    category: "email",
    displayName: "SMTP email provider",
    description: "SMTP host, credentials, sender identity, and active/backup priority for transactional email.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["username", "password"],
    settings: [
      { key: "host", description: "SMTP host.", example: "email-smtp.us-east-2.amazonaws.com" },
      { key: "port", description: "SMTP port.", example: "587" },
      { key: "secure", description: "Use TLS from connection start. Usually false for port 587 and true for 465.", example: "false" },
      { key: "fromEmail", description: "Default sender address.", example: "info@example.com" },
      { key: "fromName", description: "Default sender name.", example: "NizamKitchen" },
      { key: "deliveryMode", description: "active sends first; passive is used as fallback only.", example: "active" },
      { key: "priority", description: "Lower number is tried first among active providers.", example: "1" },
    ],
    supportedTestTypes: ["smtp_config", "smtp_connection"],
  },
  stripe: {
    provider: "stripe",
    category: "payments",
    displayName: "Stripe",
    description: "Publishable key, secret key, webhook secret, and payout readiness config.",
    publicCredentialKeys: ["publishable_key"],
    serverCredentialKeys: ["secret_key", "webhook_secret"],
    settings: [
      { key: "callbackUrl", description: "Checkout callback URL.", example: "https://app.example.com/payments/stripe/return" },
      { key: "supportedCurrencies", description: "Optional override currencies.", example: "USD,INR,GBP" },
    ],
    supportedTestTypes: ["stripe_key"],
  },
  paypal: {
    provider: "paypal",
    category: "payments",
    displayName: "PayPal",
    description: "Client credentials, webhook configuration, and live/sandbox setup.",
    publicCredentialKeys: ["client_id"],
    serverCredentialKeys: ["client_secret", "webhook_secret"],
    settings: [{ key: "merchantId", description: "Optional merchant identifier.", example: "merchant-123" }],
    supportedTestTypes: ["paypal_key"],
  },
  google_pay: {
    provider: "google_pay",
    category: "payments",
    displayName: "Google Pay Wallet",
    description: "Wallet capability flags when surfaced through a supported processor.",
    publicCredentialKeys: ["merchant_id"],
    serverCredentialKeys: [],
    settings: [
      { key: "supportedGateway", description: "Gateway that exposes Google Pay.", example: "stripe" },
      { key: "walletEnabled", description: "Enable wallet option.", example: "true" },
    ],
    supportedTestTypes: ["wallet_config"],
  },
  stripe_identity: {
    provider: "stripe_identity",
    category: "verification",
    displayName: "Stripe Identity",
    description: "Hosted identity verification sessions and webhook configuration.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["secret_key", "webhook_secret"],
    settings: [{ key: "callbackUrl", description: "Verification return URL.", example: "https://app.example.com/verification/return" }],
    supportedTestTypes: ["provider_config"],
  },
  stripe_connect: {
    provider: "stripe_connect",
    category: "verification",
    displayName: "Stripe Connect",
    description: "Seller payout onboarding and connected-account webhook configuration.",
    publicCredentialKeys: ["publishable_key"],
    serverCredentialKeys: ["secret_key", "webhook_secret"],
    settings: [{ key: "refreshUrl", description: "Connect onboarding refresh URL.", example: "https://app.example.com/settings/payments" }],
    supportedTestTypes: ["provider_config"],
  },
  persona_placeholder: {
    provider: "persona_placeholder",
    category: "verification",
    displayName: "Persona Placeholder",
    description: "Placeholder for future Persona identity verification configuration.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["api_key", "template_id", "webhook_secret"],
    settings: [{ key: "callbackUrl", description: "Hosted verification return URL.", example: "https://app.example.com/verification/persona/return" }],
    supportedTestTypes: ["provider_config"],
  },
  checkr_placeholder: {
    provider: "checkr_placeholder",
    category: "verification",
    displayName: "Checkr Placeholder",
    description: "Placeholder for future background-check candidate, consent, and report configuration.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["api_key", "webhook_secret"],
    settings: [{ key: "candidateCallbackUrl", description: "Background-check provider webhook URL.", example: "https://app.example.com/api/kyc/checkr/webhook" }],
    supportedTestTypes: ["provider_config"],
  },
  kyc_provider: {
    provider: "kyc_provider",
    category: "verification",
    displayName: "KYC Provider",
    description: "Provider credentials used for identity verification sessions.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["api_key", "secret", "webhook_secret"],
    settings: [{ key: "callbackUrl", description: "Hosted verification return URL.", example: "https://app.example.com/verification/return" }],
    supportedTestTypes: ["provider_config"],
  },
  background_check_provider: {
    provider: "background_check_provider",
    category: "verification",
    displayName: "Background Check Provider",
    description: "Provider credentials used for background check workflows.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["api_key", "secret", "webhook_secret"],
    settings: [{ key: "callbackUrl", description: "Provider callback URL.", example: "https://app.example.com/api/kyc/checkr/webhook" }],
    supportedTestTypes: ["provider_config"],
  },
  custom: {
    provider: "custom",
    category: "other",
    displayName: "Custom Integration",
    description: "Catch-all configuration record for new providers before a first-class adapter exists.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["api_key", "secret"],
    settings: [{ key: "notes", description: "Notes about the custom integration.", example: "Replace with first-class provider later." }],
    supportedTestTypes: ["configuration_check"],
  },
};

export type RedactedPlatformIntegration = Omit<PlatformIntegration, never> & {
  credentials: Array<{
    id: string;
    keyName: string;
    valuePreview: string;
    isPublicClientValue: boolean;
    createdById: string;
    updatedById: string | null;
    rotatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  settings: Array<{
    id: string;
    settingKey: string;
    settingValueJson: Prisma.JsonValue;
    isSecret: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  testLogs: Array<{
    id: string;
    testType: string;
    status: IntegrationTestStatus;
    message: string;
    metadataJson: Prisma.JsonValue | null;
    testedById: string;
    createdAt: Date;
  }>;
};

export function platformConfigurationOperationalStatus() {
  return {
    encryptionConfigured: isPaymentEncryptionConfigured(),
    revealSecretsSupported: false,
  };
}

export function listIntegrationTemplates() {
  return Object.values(INTEGRATION_TEMPLATES);
}

export function getIntegrationTemplate(provider: IntegrationProvider) {
  return INTEGRATION_TEMPLATES[provider];
}

export async function listPlatformIntegrations(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);

  const integrations = await prisma.platformIntegration.findMany({
    where: countryScopedWhere(session),
    include: {
      credentials: {
        select: {
          id: true,
          keyName: true,
          valuePreview: true,
          isPublicClientValue: true,
          createdById: true,
          updatedById: true,
          rotatedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      settings: {
        select: {
          id: true,
          settingKey: true,
          settingValueJson: true,
          isSecret: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      testLogs: {
        select: {
          id: true,
          testType: true,
          status: true,
          message: true,
          metadataJson: true,
          testedById: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: [{ provider: "asc" }, { countryCode: "asc" }, { createdAt: "desc" }],
  });

  return integrations as RedactedPlatformIntegration[];
}

export async function getPlatformIntegration(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);
  const integration = await prisma.platformIntegration.findUnique({
    where: { id },
    include: {
      credentials: {
        select: {
          id: true,
          keyName: true,
          valuePreview: true,
          isPublicClientValue: true,
          createdById: true,
          updatedById: true,
          rotatedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { keyName: "asc" },
      },
      settings: {
        select: {
          id: true,
          settingKey: true,
          settingValueJson: true,
          isSecret: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { settingKey: "asc" },
      },
      testLogs: {
        select: {
          id: true,
          testType: true,
          status: true,
          message: true,
          metadataJson: true,
          testedById: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!integration) {
    throw new Error("Integration not found.");
  }

  if (session.user.platformRole === "country_manager" && integration.countryCode) {
    assertCountryAccess(session as never, integration.countryCode);
  }

  return integration as RedactedPlatformIntegration;
}

export async function savePlatformIntegration(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
  const parsed = platformIntegrationSchema.parse(input);

  if (session.user.platformRole === "country_manager" && parsed.countryCode) {
    assertCountryAccess(session as never, parsed.countryCode);
  }

  const data = {
    provider: parsed.provider,
    category: parsed.category,
    displayName: parsed.displayName,
    description: normalizeOptionalText(parsed.description),
    status: parsed.status,
    environment: parsed.environment,
    countryCode: normalizeCountryCode(parsed.countryCode),
    region: normalizeOptionalText(parsed.region),
    isGlobal: parsed.isGlobal,
    isDefault: parsed.isDefault,
    updatedById: session.user.id,
  };

  const integration = parsed.id
    ? await prisma.platformIntegration.update({
        where: { id: parsed.id },
        data,
      })
    : await prisma.platformIntegration.create({
        data: {
          ...data,
          createdById: session.user.id,
        },
      });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: integration.countryCode,
    action: parsed.id
      ? integration.status === IntegrationStatus.disabled
        ? "platform_integration.disabled"
        : "platform_integration.updated"
      : "platform_integration.created",
    targetType: "platform_integration",
    targetId: integration.id,
    details: {
      provider: integration.provider,
      category: integration.category,
      status: integration.status,
      environment: integration.environment,
    },
  });

  if (integration.provider === IntegrationProvider.google_oauth || integration.provider === IntegrationProvider.facebook_oauth) {
    await createAuditEvent({
      actorUserId: session.user.id,
      countryCode: integration.countryCode,
      action:
        integration.status === IntegrationStatus.disabled
          ? "oauth_provider.disabled"
          : "oauth_provider.enabled",
      targetType: "platform_integration",
      targetId: integration.id,
      details: { provider: integration.provider, environment: integration.environment },
    });
  }

  return integration;
}

export async function deletePlatformIntegration(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);

  const integration = await prisma.platformIntegration.findUnique({
    where: { id },
    select: {
      id: true,
      provider: true,
      category: true,
      displayName: true,
      countryCode: true,
      environment: true,
    },
  });

  if (!integration) {
    throw new Error("Integration not found.");
  }

  await prisma.platformIntegration.delete({ where: { id: integration.id } });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: integration.countryCode,
    action: "platform_integration.deleted_or_archived",
    targetType: "platform_integration",
    targetId: integration.id,
    details: {
      provider: integration.provider,
      category: integration.category,
      displayName: integration.displayName,
      environment: integration.environment,
    },
  });

  return integration;
}

export async function setOAuthIntegrationSignInAvailability(
  session: AdminSession,
  id: string,
  enabled: boolean,
) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);

  const integration = await prisma.platformIntegration.findUnique({
    where: { id },
    select: {
      id: true,
      provider: true,
      category: true,
      displayName: true,
      countryCode: true,
      environment: true,
    },
  });

  if (!integration) {
    throw new Error("Integration not found.");
  }

  if (integration.provider !== IntegrationProvider.google_oauth && integration.provider !== IntegrationProvider.facebook_oauth) {
    throw new Error("Only social sign-in APIs can be enabled or disabled here.");
  }

  const updated = await prisma.platformIntegration.update({
    where: { id: integration.id },
    data: {
      status: enabled ? IntegrationStatus.active : IntegrationStatus.disabled,
      updatedById: session.user.id,
      settings: {
        upsert: {
          where: {
            integrationId_settingKey: {
              integrationId: integration.id,
              settingKey: "loginButtonVisible",
            },
          },
          update: {
            settingValueJson: enabled,
            isSecret: false,
          },
          create: {
            settingKey: "loginButtonVisible",
            settingValueJson: enabled,
            isSecret: false,
          },
        },
      },
    },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: integration.countryCode,
    action: enabled ? "oauth_provider.enabled" : "oauth_provider.disabled",
    targetType: "platform_integration",
    targetId: integration.id,
    details: {
      provider: integration.provider,
      category: integration.category,
      displayName: integration.displayName,
      environment: integration.environment,
      loginButtonVisible: enabled,
    },
  });

  return updated;
}

export async function importOAuthIntegrationFromEnv(
  session: AdminSession,
  provider: IntegrationProvider,
) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
  if (provider !== IntegrationProvider.google_oauth && provider !== IntegrationProvider.facebook_oauth) {
    throw new Error("Only Google OAuth and Facebook OAuth can be imported from OAuth environment variables.");
  }

  const template = getIntegrationTemplate(provider);
  const isGoogle = provider === IntegrationProvider.google_oauth;
  const clientId = isGoogle ? env.GOOGLE_OAUTH_CLIENT_ID : env.FACEBOOK_OAUTH_APP_ID;
  const clientSecret = isGoogle ? env.GOOGLE_OAUTH_CLIENT_SECRET : env.FACEBOOK_OAUTH_APP_SECRET;
  const callbackUrl =
    (isGoogle ? env.GOOGLE_OAUTH_CALLBACK_URL : env.FACEBOOK_OAUTH_CALLBACK_URL) ||
    getOAuthCallbackUrl(isGoogle ? "google" : "facebook");

  if (!clientId || !clientSecret) {
    throw new Error(`Add ${template.displayName} client ID and client secret to the running environment first.`);
  }

  const existing = await prisma.platformIntegration.findFirst({
    where: { provider, isGlobal: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const integration = await savePlatformIntegration(session, {
    id: existing?.id,
    provider,
    category: template.category,
    displayName: template.displayName,
    description: template.description,
    status: IntegrationStatus.active,
    environment: IntegrationEnvironment.development,
    countryCode: "",
    region: "",
    isGlobal: true,
    isDefault: true,
  });

  await savePlatformIntegrationCredential(session, {
    integrationId: integration.id,
    keyName: isGoogle ? "client_id" : "app_id",
    secretValue: clientId,
    isPublicClientValue: true,
  });
  await savePlatformIntegrationCredential(session, {
    integrationId: integration.id,
    keyName: isGoogle ? "client_secret" : "app_secret",
    secretValue: clientSecret,
    isPublicClientValue: false,
  });

  await Promise.all([
    savePlatformIntegrationSetting(session, {
      integrationId: integration.id,
      settingKey: "callbackUrl",
      settingValueText: callbackUrl,
    }),
    savePlatformIntegrationSetting(session, {
      integrationId: integration.id,
      settingKey: "autoCreateUser",
      settingValueText: "true",
    }),
    savePlatformIntegrationSetting(session, {
      integrationId: integration.id,
      settingKey: "loginButtonVisible",
      settingValueText: "true",
    }),
    savePlatformIntegrationSetting(session, {
      integrationId: integration.id,
      settingKey: "defaultOrganizationType",
      settingValueText: "household",
    }),
  ]);

  await createAuditEvent({
    actorUserId: session.user.id,
    action: "platform_integration.credential_rotated",
    targetType: "platform_integration",
    targetId: integration.id,
    details: {
      provider,
      source: "environment_import",
      secretValuesLogged: false,
    },
  });

  return integration;
}

export async function getIntegrationReadiness(session: AdminSession, id: string) {
  const integration = await getPlatformIntegration(session, id);
  const template = getIntegrationTemplate(integration.provider);
  const credentialKeys = new Set(integration.credentials.map((credential) => credential.keyName));
  const settingKeys = new Set(integration.settings.map((setting) => setting.settingKey));
  const requiredCredentialKeys = providerRequiredCredentialKeys(integration.provider);
  const requiredSettingKeys = providerRequiredSettingKeys(integration.provider);

  return {
    integration,
    template,
    missingCredentialKeys: requiredCredentialKeys.filter((key) => !credentialKeys.has(key)),
    missingSettingKeys: requiredSettingKeys.filter((key) => !settingKeys.has(key)),
    savedCredentialKeys: requiredCredentialKeys.filter((key) => credentialKeys.has(key)),
    suggestedSettingKeys: template.settings.map((setting) => setting.key),
    savedSettingKeys: template.settings.map((setting) => setting.key).filter((key) => settingKeys.has(key)),
  };
}

export async function savePlatformIntegrationCredential(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, SECRET_ROLES);
  if (!isPaymentEncryptionConfigured()) {
    throw new Error("ENCRYPTION_KEY is required before saving integration secrets.");
  }

  const parsed = platformIntegrationCredentialSchema.parse(input);
  const integration = await prisma.platformIntegration.findUnique({
    where: { id: parsed.integrationId },
    select: { id: true, provider: true, countryCode: true },
  });

  if (!integration) {
    throw new Error("Integration not found.");
  }

  if (session.user.platformRole === "country_manager" && integration.countryCode) {
    assertCountryAccess(session as never, integration.countryCode);
  }

  const encryptedValue = encryptGatewayCredential(parsed.secretValue);
  const valuePreview = maskCredentialPreview(parsed.secretValue);
  const existing = await prisma.platformIntegrationCredential.findUnique({
    where: {
      integrationId_keyName: {
        integrationId: integration.id,
        keyName: parsed.keyName,
      },
    },
  });

  const credential = existing
    ? await prisma.platformIntegrationCredential.update({
        where: { id: existing.id },
        data: {
          encryptedValue,
          valuePreview,
          isPublicClientValue: parsed.isPublicClientValue,
          rotatedAt: new Date(),
          updatedById: session.user.id,
        },
      })
    : await prisma.platformIntegrationCredential.create({
        data: {
          integrationId: integration.id,
          keyName: parsed.keyName,
          encryptedValue,
          valuePreview,
          isPublicClientValue: parsed.isPublicClientValue,
          createdById: session.user.id,
          updatedById: session.user.id,
          rotatedAt: new Date(),
        },
      });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: integration.countryCode,
    action: existing ? "platform_integration.credential_rotated" : "platform_integration.credential_added",
    targetType: "platform_integration_credential",
    targetId: credential.id,
    details: {
      provider: integration.provider,
      keyName: credential.keyName,
      isPublicClientValue: credential.isPublicClientValue,
    },
  });

  if (integration.provider === IntegrationProvider.google_oauth || integration.provider === IntegrationProvider.facebook_oauth) {
    await createAuditEvent({
      actorUserId: session.user.id,
      countryCode: integration.countryCode,
      action: "oauth_provider.credentials_updated",
      targetType: "platform_integration_credential",
      targetId: credential.id,
      details: { provider: integration.provider, keyName: credential.keyName },
    });
  }

  return redactCredentialRecord(credential);
}

export async function savePlatformIntegrationSetting(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
  const parsed = platformIntegrationSettingSchema.parse(input);

  if (parsed.isSecret) {
    throw new Error("Secret settings must be stored as encrypted credentials.");
  }

  const integration = await prisma.platformIntegration.findUnique({
    where: { id: parsed.integrationId },
    select: { id: true, provider: true, countryCode: true },
  });

  if (!integration) {
    throw new Error("Integration not found.");
  }

  if (session.user.platformRole === "country_manager" && integration.countryCode) {
    assertCountryAccess(session as never, integration.countryCode);
  }

  const settingValueJson = normalizeSettingValue(parsed) as Prisma.InputJsonValue;
  const setting = await prisma.platformIntegrationSetting.upsert({
    where: {
      integrationId_settingKey: {
        integrationId: integration.id,
        settingKey: parsed.settingKey,
      },
    },
    update: {
      settingValueJson,
      isSecret: false,
    },
    create: {
      integrationId: integration.id,
      settingKey: parsed.settingKey,
      settingValueJson,
      isSecret: false,
    },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: integration.countryCode,
    action: "platform_integration.updated",
    targetType: "platform_integration_setting",
    targetId: setting.id,
    details: {
      provider: integration.provider,
      settingKey: setting.settingKey,
    },
  });

  return setting;
}

export async function getActiveIntegration(provider: IntegrationProvider, countryCode?: string | null) {
  const integrations = await prisma.platformIntegration.findMany({
    where: {
      provider,
      status: IntegrationStatus.active,
      OR: countryCode ? [{ countryCode: countryCode.toUpperCase() }, { isGlobal: true }, { countryCode: null }] : undefined,
    },
    include: {
      credentials: true,
      settings: true,
    },
    orderBy: [{ isDefault: "desc" }, { isGlobal: "desc" }, { createdAt: "desc" }],
  });

  const integration = chooseBestIntegration(integrations, countryCode);
  return integration ? redactIntegrationForServer(integration) : null;
}

export async function listActiveSmtpIntegrations(countryCode?: string | null) {
  const integrations = await prisma.platformIntegration.findMany({
    where: {
      provider: IntegrationProvider.smtp,
      status: IntegrationStatus.active,
      OR: countryCode ? [{ countryCode: countryCode.toUpperCase() }, { isGlobal: true }, { countryCode: null }] : undefined,
    },
    include: {
      credentials: true,
      settings: true,
    },
    orderBy: [{ isDefault: "desc" }, { isGlobal: "desc" }, { createdAt: "asc" }],
  });

  return integrations
    .map(redactIntegrationForServer)
    .sort((left, right) => {
      const leftMode = getServerSetting(left, "deliveryMode", "active");
      const rightMode = getServerSetting(right, "deliveryMode", "active");
      const leftPriority = Number(getServerSetting(left, "priority", 100));
      const rightPriority = Number(getServerSetting(right, "priority", 100));
      if (leftMode !== rightMode) return leftMode === "active" ? -1 : 1;
      return leftPriority - rightPriority;
    });
}

export async function getCredential(integrationId: string, keyName: string) {
  const credential = await prisma.platformIntegrationCredential.findUnique({
    where: {
      integrationId_keyName: {
        integrationId,
        keyName,
      },
    },
  });

  if (!credential) {
    return null;
  }

  return decryptGatewayCredential(credential.encryptedValue);
}

export async function getPublicIntegrationConfig(provider: IntegrationProvider, countryCode?: string | null) {
  const integration = await getActiveIntegration(provider, countryCode);
  if (!integration) {
    return null;
  }

  return {
    id: integration.id,
    provider: integration.provider,
    displayName: integration.displayName,
    countryCode: integration.countryCode,
    region: integration.region,
    environment: integration.environment,
    settings: Object.fromEntries(
      integration.settings
        .filter((setting) => !setting.isSecret)
        .map((setting) => [setting.settingKey, setting.settingValueJson]),
    ),
    credentials: Object.fromEntries(
      integration.credentials
        .filter((credential) => credential.isPublicClientValue)
        .map((credential) => [credential.keyName, credential.value]),
    ),
  };
}

export async function requireIntegration(provider: IntegrationProvider, countryCode?: string | null) {
  const integration = await getActiveIntegration(provider, countryCode);
  if (!integration) {
    throw new Error(`${humanizeProvider(provider)} is not configured yet.`);
  }
  return integration;
}

export async function testIntegration(provider: IntegrationProvider, integrationId: string) {
  const integration = await prisma.platformIntegration.findUnique({
    where: { id: integrationId },
    include: {
      credentials: true,
      settings: true,
    },
  });

  if (!integration || integration.provider !== provider) {
    throw new Error("Integration not found.");
  }

  return buildTestResult(integration, "configuration_check");
}

export async function runPlatformIntegrationTest(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
  const parsed = platformIntegrationTestSchema.parse(input);
  const integration = await prisma.platformIntegration.findUnique({
    where: { id: parsed.integrationId },
    include: {
      credentials: true,
      settings: true,
    },
  });

  if (!integration) {
    throw new Error("Integration not found.");
  }

  if (session.user.platformRole === "country_manager" && integration.countryCode) {
    assertCountryAccess(session as never, integration.countryCode);
  }

  const result = await buildTestResult(integration, parsed.testType);
  const log = await prisma.platformIntegrationTestLog.create({
    data: {
      integrationId: integration.id,
      testType: parsed.testType,
      status: result.status,
      message: result.message,
      metadataJson: result.metadata as Prisma.InputJsonValue | undefined,
      testedById: session.user.id,
    },
  });

  await prisma.platformIntegration.update({
    where: { id: integration.id },
    data: {
      lastTestedAt: log.createdAt,
      lastTestStatus: result.status,
      lastTestMessage: result.message,
      updatedById: session.user.id,
    },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: integration.countryCode,
    action: "platform_integration.tested",
    targetType: "platform_integration_test",
    targetId: log.id,
    details: {
      provider: integration.provider,
      testType: parsed.testType,
      status: result.status,
    },
  });

  return log;
}

async function buildTestResult(
  integration: PlatformIntegration & {
    credentials: Array<{ keyName: string; encryptedValue: string; isPublicClientValue: boolean }>;
    settings: Array<{ settingKey: string; settingValueJson: Prisma.JsonValue; isSecret: boolean }>;
  },
  testType: string,
) {
  const settings = Object.fromEntries(integration.settings.map((setting) => [setting.settingKey, setting.settingValueJson]));
  const credentialKeys = new Set(integration.credentials.map((credential) => credential.keyName));
  const settingKeys = new Set(integration.settings.map((setting) => setting.settingKey));
  const template = getIntegrationTemplate(integration.provider);
  const requiredKeys = providerRequiredCredentialKeys(integration.provider);
  const requiredSettingKeys = providerRequiredSettingKeys(integration.provider);
  const missingKeys = requiredKeys.filter((key) => !credentialKeys.has(key));
  const missingSettings = requiredSettingKeys.filter((key) => !settingKeys.has(key));
  const expectedOAuthCallbackPath =
    integration.provider === IntegrationProvider.google_oauth
      ? getOAuthCallbackPath("google")
      : integration.provider === IntegrationProvider.facebook_oauth
        ? getOAuthCallbackPath("facebook")
        : null;

  if (integration.status !== IntegrationStatus.active) {
    return {
      status: IntegrationTestStatus.failed,
      message: "Activate the integration before running tests.",
      metadata: { provider: integration.provider, testType },
    };
  }

  if (missingKeys.length > 0) {
    return {
      status: IntegrationTestStatus.failed,
      message: `Missing credentials: ${missingKeys.join(", ")}.`,
      metadata: { provider: integration.provider, testType, missingKeys },
    };
  }

  if (missingSettings.length > 0) {
    return {
      status: IntegrationTestStatus.failed,
      message: `Missing settings: ${missingSettings.join(", ")}.`,
      metadata: { provider: integration.provider, testType, missingSettings },
    };
  }

  if (testType === "oauth_config" && expectedOAuthCallbackPath) {
    const callbackUrl = typeof settings.callbackUrl === "string" ? settings.callbackUrl : "";
    if (!callbackUrl) {
      return {
        status: IntegrationTestStatus.failed,
        message: `Add the OAuth callback URL ending in ${expectedOAuthCallbackPath}.`,
        metadata: { provider: integration.provider, testType, expectedCallbackPath: expectedOAuthCallbackPath },
      };
    }

    try {
      const parsedCallbackUrl = new URL(callbackUrl);
      if (
        expectedOAuthCallbackPath &&
        isProductionRuntime() &&
        isLocalhostUrl(parsedCallbackUrl.toString())
      ) {
        return {
          status: IntegrationTestStatus.failed,
          message: "Production OAuth callback points to localhost. Configure APP_URL=https://nk.friscodawah.org and use the generated production callback URL.",
          metadata: {
            provider: integration.provider,
            testType,
            expectedCallbackPath: expectedOAuthCallbackPath,
            configuredHost: parsedCallbackUrl.host,
          },
        };
      }
      if (parsedCallbackUrl.pathname !== expectedOAuthCallbackPath) {
        return {
          status: IntegrationTestStatus.failed,
          message: `OAuth callback URL must end in ${expectedOAuthCallbackPath}. Do not use the /start URL as the callback.`,
          metadata: {
            provider: integration.provider,
            testType,
            expectedCallbackPath: expectedOAuthCallbackPath,
            configuredPath: parsedCallbackUrl.pathname,
          },
        };
      }
    } catch {
      return {
        status: IntegrationTestStatus.failed,
        message: "OAuth callback URL must be a full URL, such as http://localhost:3000/api/auth/oauth/google/callback.",
        metadata: { provider: integration.provider, testType, expectedCallbackPath: expectedOAuthCallbackPath },
      };
    }
  }

  if (integration.provider === IntegrationProvider.aws_s3) {
    return {
      status: IntegrationTestStatus.success,
      message: "Configuration looks complete. Use the storage module tests for live bucket connection, upload, read, and delete checks.",
      metadata: { provider: integration.provider, bucketName: settings.bucketName ?? null },
    };
  }

  if (integration.provider === IntegrationProvider.smtp) {
    const missingSettings = ["host", "port", "fromEmail"].filter((key) => !settings[key]);
    if (missingSettings.length > 0) {
      return {
        status: IntegrationTestStatus.failed,
        message: `Missing SMTP settings: ${missingSettings.join(", ")}.`,
        metadata: { provider: integration.provider, testType, missingSettings },
      };
    }

    if (testType === "smtp_connection") {
      const connectionResult = await testSmtpConnection(integration, settings);
      return connectionResult;
    }

    return {
      status: IntegrationTestStatus.success,
      message: "SMTP settings are present. Run Test smtp connection to verify the host, port, username, and password.",
      metadata: {
        provider: integration.provider,
        hostConfigured: Boolean(settings.host),
        fromEmailConfigured: Boolean(settings.fromEmail),
        deliveryMode: settings.deliveryMode ?? "active",
      },
    };
  }

  if (integration.provider === IntegrationProvider.secure_privacy) {
    const scriptUrl = typeof settings.scriptUrl === "string" ? settings.scriptUrl : "";
    const scriptUrlResult = validateSecurePrivacyScriptUrl(scriptUrl);
    if (!scriptUrlResult.ok) {
      return {
        status: IntegrationTestStatus.failed,
        message: scriptUrlResult.message,
        metadata: { provider: integration.provider, testType, scriptUrlConfigured: Boolean(scriptUrl) },
      };
    }

    return {
      status: IntegrationTestStatus.success,
      message: "Secure Privacy script URL is valid. Consent Mode and Google Analytics integration settings are ready.",
      metadata: {
        provider: integration.provider,
        testType,
        consentModeEnabled: settings.consentModeEnabled ?? false,
        googleAnalyticsConsentEnabled: settings.googleAnalyticsConsentEnabled ?? settings.googleAnalyticsIntegrationEnabled ?? false,
        googleAnalyticsIntegrationEnabled: settings.googleAnalyticsIntegrationEnabled ?? settings.googleAnalyticsConsentEnabled ?? false,
      },
      };
  }

  if (!template.supportedTestTypes.includes(testType)) {
    return {
      status: IntegrationTestStatus.failed,
      message: "Test not implemented yet for this provider.",
      metadata: { provider: integration.provider, testType },
    };
  }

  return {
    status: IntegrationTestStatus.success,
    message: "Configuration saved and validated. Provider-specific live test hooks are ready for future adapters.",
    metadata: { provider: integration.provider, testType },
  };
}

function validateSecurePrivacyScriptUrl(scriptUrl: string) {
  if (!scriptUrl) return { ok: false, message: "Add the Secure Privacy script URL." };

  try {
    const parsed = new URL(scriptUrl);
    if (parsed.protocol !== "https:") {
      return { ok: false, message: "Secure Privacy script URL must use HTTPS." };
    }
    if (parsed.hostname !== "app.secureprivacy.ai") {
      return { ok: false, message: "Secure Privacy script URL must come from app.secureprivacy.ai." };
    }
    if (!parsed.pathname.startsWith("/script/") || !parsed.pathname.endsWith(".js")) {
      return { ok: false, message: "Secure Privacy script URL must point to a /script/*.js file." };
    }
    return { ok: true, message: "Valid Secure Privacy script URL." };
  } catch {
    return { ok: false, message: "Secure Privacy script URL must be a full URL." };
  }
}

async function testSmtpConnection(
  integration: PlatformIntegration & {
    credentials: Array<{ keyName: string; encryptedValue: string; isPublicClientValue: boolean }>;
  },
  settings: Record<string, Prisma.JsonValue>,
) {
  const nodemailer = loadNodemailer();
  const username = decryptIntegrationCredential(integration, "username");
  const password = decryptIntegrationCredential(integration, "password");
  const host = String(settings.host ?? "");
  const port = Number(settings.port ?? 587);
  const secure = settings.secure === true || settings.secure === "true" || port === 465;

  if (!nodemailer) {
    return {
      status: IntegrationTestStatus.failed,
      message: "SMTP testing is not available on this server. Install dependencies and rebuild the app, then try again.",
      metadata: { provider: integration.provider, testType: "smtp_connection", hostConfigured: Boolean(host) },
    };
  }

  if (!username || !password || !host || !Number.isFinite(port)) {
    return {
      status: IntegrationTestStatus.failed,
      message: "SMTP host, port, username, and password are required before testing.",
      metadata: { provider: integration.provider, testType: "smtp_connection", hostConfigured: Boolean(host) },
    };
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: username, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
    await transport.verify();
    transport.close();
    return {
      status: IntegrationTestStatus.success,
      message: "SMTP connection verified successfully.",
      metadata: { provider: integration.provider, testType: "smtp_connection", host, port, secure },
    };
  } catch {
    return {
      status: IntegrationTestStatus.failed,
      message: "SMTP connection failed. Check host, port, username, password, TLS mode, and provider account status.",
      metadata: { provider: integration.provider, testType: "smtp_connection", host, port, secure },
    };
  }
}

function decryptIntegrationCredential(
  integration: { credentials: Array<{ keyName: string; encryptedValue: string }> },
  keyName: string,
) {
  const credential = integration.credentials.find((item) => item.keyName === keyName);
  return credential ? decryptGatewayCredential(credential.encryptedValue) : null;
}

function getServerSetting(
  integration: { settings: Array<{ settingKey: string; settingValueJson: Prisma.JsonValue }> },
  keyName: string,
  fallback: string | number,
) {
  return integration.settings.find((setting) => setting.settingKey === keyName)?.settingValueJson ?? fallback;
}

function chooseBestIntegration(
  integrations: Array<
    PlatformIntegration & {
      credentials: Array<{ keyName: string; encryptedValue: string; isPublicClientValue: boolean }>;
      settings: Array<{ settingKey: string; settingValueJson: Prisma.JsonValue; isSecret: boolean }>;
    }
  >,
  countryCode?: string | null,
) {
  if (!countryCode) {
    return integrations[0] ?? null;
  }

  const upperCountry = countryCode.toUpperCase();
  return (
    integrations.find((integration) => integration.countryCode === upperCountry) ??
    integrations.find((integration) => integration.isGlobal || integration.countryCode === null) ??
    integrations[0] ??
    null
  );
}

function redactIntegrationForServer(
  integration: PlatformIntegration & {
    credentials: Array<{ keyName: string; encryptedValue: string; isPublicClientValue: boolean }>;
    settings: Array<{ settingKey: string; settingValueJson: Prisma.JsonValue; isSecret: boolean }>;
  },
) {
  return {
    ...integration,
    credentials: integration.credentials.map((credential) => ({
      keyName: credential.keyName,
      isPublicClientValue: credential.isPublicClientValue,
      value: decryptGatewayCredential(credential.encryptedValue),
    })),
    settings: integration.settings.map((setting) => ({
      settingKey: setting.settingKey,
      settingValueJson: setting.settingValueJson,
      isSecret: setting.isSecret,
    })),
  };
}

function redactCredentialRecord(credential: {
  id: string;
  keyName: string;
  valuePreview: string;
  isPublicClientValue: boolean;
  createdById: string;
  updatedById: string | null;
  rotatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return credential;
}

function countryScopedWhere(session: AdminSession) {
  if (session.user.platformRole === "country_manager") {
    return {
      OR: [
        { countryCode: { in: session.countryAssignments?.map((assignment) => assignment.countryCode) ?? [] } },
        { isGlobal: true },
        { countryCode: null },
      ],
    };
  }

  return {};
}

function normalizeCountryCode(value: string | undefined) {
  return value && value.trim() ? value.trim().toUpperCase() : null;
}

function normalizeOptionalText(value: string | undefined) {
  return value && value.trim() ? value.trim() : null;
}

function humanizeProvider(provider: IntegrationProvider) {
  return provider.replace(/_/g, " ");
}
