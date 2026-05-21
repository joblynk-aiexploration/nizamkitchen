import {
  IntegrationCategory,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationTestStatus,
  type PlatformIntegration,
  type PlatformRole,
  type Prisma,
  type UserStatus,
} from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeSettingValue,
  platformIntegrationCredentialSchema,
  platformIntegrationSchema,
  platformIntegrationSettingSchema,
  platformIntegrationTestSchema,
} from "@/lib/validation/platform-config";
import { createAuditEvent } from "@/server/audit";
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
    displayName: "SMTP",
    description: "SMTP host, credentials, and from address for transactional email.",
    publicCredentialKeys: [],
    serverCredentialKeys: ["username", "password"],
    settings: [
      { key: "host", description: "SMTP host.", example: "smtp.mailgun.org" },
      { key: "port", description: "SMTP port.", example: "587" },
      { key: "fromEmail", description: "Default sender address.", example: "hello@nizamkitchen.dev" },
    ],
    supportedTestTypes: ["smtp_placeholder"],
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

  const result = buildTestResult(integration, parsed.testType);
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

function buildTestResult(
  integration: PlatformIntegration & {
    credentials: Array<{ keyName: string; encryptedValue: string; isPublicClientValue: boolean }>;
    settings: Array<{ settingKey: string; settingValueJson: Prisma.JsonValue; isSecret: boolean }>;
  },
  testType: string,
) {
  const settings = Object.fromEntries(integration.settings.map((setting) => [setting.settingKey, setting.settingValueJson]));
  const credentialKeys = new Set(integration.credentials.map((credential) => credential.keyName));
  const template = getIntegrationTemplate(integration.provider);
  const requiredKeys = [...template.publicCredentialKeys, ...template.serverCredentialKeys];
  const missingKeys = requiredKeys.filter((key) => !credentialKeys.has(key));

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

  if (integration.provider === IntegrationProvider.aws_s3) {
    return {
      status: IntegrationTestStatus.success,
      message: "Configuration looks complete. Use the storage module tests for live bucket connection, upload, read, and delete checks.",
      metadata: { provider: integration.provider, bucketName: settings.bucketName ?? null },
    };
  }

  if (integration.provider === IntegrationProvider.smtp) {
    return {
      status: IntegrationTestStatus.success,
      message: "SMTP settings are present. Safe send verification is still a placeholder from this vault page.",
      metadata: { provider: integration.provider, hostConfigured: Boolean(settings.host) },
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
