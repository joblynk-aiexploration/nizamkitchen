import { IntegrationProvider, type IntegrationCategory } from "@prisma/client";

export type ProviderFieldKind = "credential" | "setting";
export type ProviderFieldType = "text" | "password" | "url" | "email" | "number" | "select" | "textarea";

export type ProviderFieldDefinition = {
  key: string;
  label: string;
  kind: ProviderFieldKind;
  type?: ProviderFieldType;
  required?: boolean;
  secret?: boolean;
  publicClient?: boolean;
  advanced?: boolean;
  readOnlyGenerated?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
};

export type ProviderFormDefinition = {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  displayName: string;
  description: string;
  setupGuide: string;
  testDescription: string;
  generatedCallbackPath?: string;
  generatedWebhookPath?: string;
  fields: ProviderFieldDefinition[];
};

const enabledForms = [
  "login",
  "register",
  "contact",
  "support",
  "checkout",
  "seller onboarding",
];

export const providerFormRegistry: Record<IntegrationProvider, ProviderFormDefinition> = {
  google_oauth: {
    provider: "google_oauth",
    category: "auth",
    displayName: "Google OAuth",
    description: "Google sign-in and sign-up credentials.",
    setupGuide: "Create OAuth credentials in Google Cloud Console. Add the callback URL shown below to Authorized redirect URIs.",
    testDescription: "Validate the client ID, client secret, and callback URL shape. No live user login is performed.",
    generatedCallbackPath: "/api/auth/oauth/google/callback",
    fields: [
      { kind: "credential", key: "client_id", label: "Client ID", required: true, publicClient: true, helpText: "Public OAuth client ID from Google Cloud Console." },
      { kind: "credential", key: "client_secret", label: "Client Secret", type: "password", required: true, secret: true, helpText: "Server-only OAuth secret. Never exposed to the browser." },
      { kind: "setting", key: "callbackUrl", label: "Authorized callback URL", type: "url", required: true, readOnlyGenerated: true, helpText: "Add this exact URL in Google Cloud Console." },
      { kind: "setting", key: "allowedDomains", label: "Allowed email domains", advanced: true, placeholder: "example.com, company.com" },
      { kind: "setting", key: "autoCreateUser", label: "Auto-create users", type: "select", advanced: true, options: booleanOptions(), placeholder: "true" },
      { kind: "setting", key: "defaultOrganizationType", label: "Default onboarding route", type: "select", advanced: true, options: organizationTypeOptions() },
      { kind: "setting", key: "loginButtonVisible", label: "Show login button", type: "select", advanced: true, options: booleanOptions(), placeholder: "true" },
    ],
  },
  facebook_oauth: {
    provider: "facebook_oauth",
    category: "auth",
    displayName: "Facebook OAuth",
    description: "Facebook login and registration credentials.",
    setupGuide: "Create a Facebook app and add the callback URL shown below under Valid OAuth Redirect URIs.",
    testDescription: "Validate the app ID, app secret, and callback URL shape. No live user login is performed.",
    generatedCallbackPath: "/api/auth/oauth/facebook/callback",
    fields: [
      { kind: "credential", key: "app_id", label: "App ID", required: true, publicClient: true },
      { kind: "credential", key: "app_secret", label: "App Secret", type: "password", required: true, secret: true },
      { kind: "setting", key: "callbackUrl", label: "Authorized callback URL", type: "url", required: true, readOnlyGenerated: true, helpText: "Add this exact URL in Facebook Login settings." },
      { kind: "setting", key: "autoCreateUser", label: "Auto-create users", type: "select", advanced: true, options: booleanOptions(), placeholder: "true" },
      { kind: "setting", key: "defaultOrganizationType", label: "Default onboarding route", type: "select", advanced: true, options: organizationTypeOptions() },
      { kind: "setting", key: "loginButtonVisible", label: "Show login button", type: "select", advanced: true, options: booleanOptions(), placeholder: "true" },
    ],
  },
  google_maps: {
    provider: "google_maps",
    category: "maps",
    displayName: "Google Maps",
    description: "Maps JavaScript API and map display settings.",
    setupGuide: "Create restricted Google Maps keys in Google Cloud Console. Public browser keys should be HTTP-referrer restricted.",
    testDescription: "Validate required map keys and sample configuration.",
    fields: [
      { kind: "credential", key: "browser_api_key", label: "Browser API Key", required: true, publicClient: true, helpText: "Public value. Restrict it in Google Cloud Console." },
      { kind: "credential", key: "server_api_key", label: "Server API Key", type: "password", required: true, secret: true },
      { kind: "setting", key: "defaultCountry", label: "Default country", required: true, placeholder: "US" },
      { kind: "setting", key: "defaultMapCenter", label: "Default city/center", placeholder: "{\"lat\":32.7767,\"lng\":-96.7970}" },
      { kind: "setting", key: "defaultRadiusMeters", label: "Default search radius", type: "number", placeholder: "5000" },
      { kind: "setting", key: "enabledApis", label: "Enabled APIs", advanced: true, placeholder: "maps,javascript,places,geocoding" },
      { kind: "setting", key: "allowedCountries", label: "Country allowlist", advanced: true, placeholder: "US,CA,AE" },
    ],
  },
  google_places: mapsSibling("google_places", "Google Places", "Places search and address autocomplete.", "Places API"),
  google_geocoding: mapsSibling("google_geocoding", "Google Geocoding", "Address geocoding and normalization.", "Geocoding API"),
  youtube_data: {
    provider: "youtube_data",
    category: "marketplace",
    displayName: "YouTube Data API",
    description: "Server-side YouTube discovery for recipe video references.",
    setupGuide: "Create a server API key in Google Cloud Console and restrict it to YouTube Data API.",
    testDescription: "Run a small safe YouTube API request when configured.",
    fields: [
      { kind: "credential", key: "server_api_key", label: "Server API Key", type: "password", required: true, secret: true },
      { kind: "setting", key: "discoveryEnabled", label: "Discovery enabled", type: "select", required: true, options: booleanOptions(), placeholder: "true" },
      { kind: "setting", key: "defaultSearchRegion", label: "Default search region", placeholder: "US" },
      { kind: "setting", key: "defaultSearchLanguage", label: "Default search language", placeholder: "en" },
      { kind: "setting", key: "maxResultsPerRecipe", label: "Max results per recipe", type: "number", advanced: true, placeholder: "5" },
      { kind: "setting", key: "safeSearch", label: "Safe search", advanced: true, placeholder: "moderate" },
    ],
  },
  smtp: {
    provider: "smtp",
    category: "email",
    displayName: "SMTP Email Provider",
    description: "Transactional email delivery through SMTP.",
    setupGuide: "Enter SMTP host, port, username, password, and sender identity. Use Test Email to verify delivery.",
    testDescription: "Validate SMTP configuration. Sending a test email should require an explicit recipient.",
    fields: [
      { kind: "setting", key: "host", label: "Host", required: true, placeholder: "email-smtp.us-east-2.amazonaws.com" },
      { kind: "setting", key: "port", label: "Port", type: "number", required: true, placeholder: "587" },
      { kind: "credential", key: "username", label: "Username", required: true, secret: true },
      { kind: "credential", key: "password", label: "Password", type: "password", required: true, secret: true },
      { kind: "setting", key: "fromEmail", label: "From email", type: "email", required: true, placeholder: "info@example.com" },
      { kind: "setting", key: "fromName", label: "From name", required: true, placeholder: "NizamKitchen" },
      { kind: "setting", key: "replyToEmail", label: "Reply-to email", type: "email", advanced: true },
      { kind: "setting", key: "deliveryMode", label: "Delivery mode", type: "select", advanced: true, options: [{ value: "active", label: "Active" }, { value: "passive", label: "Passive fallback" }] },
      { kind: "setting", key: "priority", label: "Priority", type: "number", advanced: true, placeholder: "1" },
      { kind: "setting", key: "secure", label: "TLS/SSL mode", type: "select", advanced: true, options: booleanOptions(), placeholder: "false" },
    ],
  },
  aws_s3: s3Fields("aws_s3", "AWS S3", "AWS S3 object storage for uploads and private documents."),
  s3_compatible: s3Fields("s3_compatible", "S3-Compatible Storage", "S3-compatible object storage endpoint."),
  stripe: {
    provider: "stripe",
    category: "payments",
    displayName: "Stripe",
    description: "Stripe payments, checkout, webhooks, and optional Connect payouts.",
    setupGuide: "Use test keys in development. Add the webhook URL to Stripe Dashboard.",
    testDescription: "Validate keys with a safe account request. No charge is created.",
    generatedWebhookPath: "/api/payments/stripe/webhook",
    fields: [
      { kind: "credential", key: "publishable_key", label: "Publishable key", required: true, publicClient: true },
      { kind: "credential", key: "secret_key", label: "Secret key", type: "password", required: true, secret: true },
      { kind: "credential", key: "webhook_secret", label: "Webhook signing secret", type: "password", required: true, secret: true },
      { kind: "setting", key: "connectEnabled", label: "Connect enabled", type: "select", advanced: true, options: booleanOptions() },
      { kind: "setting", key: "platformCommissionDefault", label: "Platform commission default", advanced: true, placeholder: "15" },
      { kind: "setting", key: "supportedCountries", label: "Supported countries", advanced: true, placeholder: "US,CA" },
      { kind: "setting", key: "supportedCurrencies", label: "Supported currencies", advanced: true, placeholder: "USD,CAD" },
    ],
  },
  paypal: {
    provider: "paypal",
    category: "payments",
    displayName: "PayPal",
    description: "PayPal checkout credentials and webhook configuration.",
    setupGuide: "Use sandbox credentials before live launch. No real charge is created by tests.",
    testDescription: "Validate credentials. No charge is created.",
    fields: [
      { kind: "credential", key: "client_id", label: "Client ID", required: true, publicClient: true },
      { kind: "credential", key: "client_secret", label: "Client Secret", type: "password", required: true, secret: true },
      { kind: "credential", key: "webhook_secret", label: "Webhook secret", type: "password", advanced: true, secret: true },
      { kind: "setting", key: "merchantId", label: "Merchant ID", advanced: true },
      { kind: "setting", key: "supportedCountries", label: "Supported countries", advanced: true, placeholder: "US,CA" },
      { kind: "setting", key: "supportedCurrencies", label: "Supported currencies", advanced: true, placeholder: "USD,CAD" },
    ],
  },
  google_pay: {
    provider: "google_pay",
    category: "payments",
    displayName: "Google Pay Wallet",
    description: "Wallet display settings through a supported processor.",
    setupGuide: "Google Pay is usually enabled through a supported processor such as Stripe. Do not use direct token processing unless a supported gateway is configured.",
    testDescription: "Validate wallet configuration only. No payment token is processed.",
    fields: [
      { kind: "credential", key: "merchant_id", label: "Merchant ID", required: true, publicClient: true },
      { kind: "setting", key: "merchantName", label: "Merchant name", required: true },
      { kind: "setting", key: "supportedGateway", label: "Supported gateway", type: "select", required: true, options: [{ value: "stripe", label: "Stripe" }, { value: "paypal", label: "PayPal" }] },
      { kind: "setting", key: "supportedCountries", label: "Supported countries", advanced: true },
      { kind: "setting", key: "supportedCurrencies", label: "Supported currencies", advanced: true },
    ],
  },
  google_analytics: {
    provider: "google_analytics",
    category: "analytics",
    displayName: "Google Analytics",
    description: "Google Analytics measurement and consent controls.",
    setupGuide: "Add the Measurement ID from Google Analytics. This value is public and should not be treated as a secret.",
    testDescription: "Validate the Measurement ID format and enabled status.",
    fields: [
      { kind: "credential", key: "measurement_id", label: "Measurement ID", required: true, publicClient: true },
      { kind: "setting", key: "consentRequired", label: "Consent required", type: "select", advanced: true, options: booleanOptions() },
      { kind: "setting", key: "trackPageViews", label: "Track page views", type: "select", advanced: true, options: booleanOptions() },
      { kind: "setting", key: "trackEvents", label: "Track conversion events", advanced: true },
      { kind: "setting", key: "debugMode", label: "Debug mode", type: "select", advanced: true, options: booleanOptions() },
    ],
  },
  secure_privacy: {
    provider: "secure_privacy",
    category: "consent",
    displayName: "Secure Privacy CMP",
    description: "Secure Privacy cookie banner and consent mode controls.",
    setupGuide: "Paste the Secure Privacy script URL from Secure Privacy. Keep Google Analytics configured separately under Google Analytics.",
    testDescription: "Validate the script URL and consent-mode settings.",
    fields: [
      { kind: "setting", key: "scriptUrl", label: "Script URL", type: "url", required: true, placeholder: "https://app.secureprivacy.ai/script/6a265d6522609752e3d645f1.js", helpText: "Public Secure Privacy script URL. The script loads only when this integration is enabled." },
      { kind: "setting", key: "consentModeEnabled", label: "Consent Mode enabled", type: "select", required: true, options: booleanOptions(), placeholder: "true" },
      { kind: "setting", key: "googleAnalyticsConsentEnabled", label: "Google Analytics consent enabled", type: "select", required: true, options: booleanOptions(), placeholder: "true" },
      { kind: "setting", key: "googleAnalyticsIntegrationEnabled", label: "Google Analytics integration legacy alias", type: "select", advanced: true, options: booleanOptions(), placeholder: "true" },
    ],
  },
  google_search_console: {
    provider: "google_search_console",
    category: "seo",
    displayName: "Google Search Console",
    description: "Search Console verification settings.",
    setupGuide: "Paste the verification meta tag content from Google Search Console.",
    testDescription: "Validate verification fields are present.",
    fields: [
      { kind: "setting", key: "sitePropertyUrl", label: "Site property URL", type: "url", required: true },
      { kind: "credential", key: "verification_meta_tag", label: "Verification meta tag content", required: true, publicClient: true },
      { kind: "credential", key: "verification_html_token", label: "HTML verification token", advanced: true, publicClient: true },
      { kind: "setting", key: "sitemapUrl", label: "Sitemap URL", type: "url", advanced: true },
    ],
  },
  google_recaptcha: {
    provider: "google_recaptcha",
    category: "security",
    displayName: "Google reCAPTCHA",
    description: "Bot protection for public forms.",
    setupGuide: "Add the site key and secret key from Google reCAPTCHA. The site key is public; the secret key is server-only.",
    testDescription: "Validate keys and page targeting. Live token verification is mocked/safe unless configured.",
    fields: [
      { kind: "setting", key: "version", label: "Version", type: "select", required: true, options: [{ value: "v2", label: "v2" }, { value: "v3", label: "v3" }] },
      { kind: "credential", key: "site_key", label: "Site key", required: true, publicClient: true },
      { kind: "credential", key: "secret_key", label: "Secret key", type: "password", required: true, secret: true },
      { kind: "setting", key: "scoreThreshold", label: "Score threshold", type: "number", advanced: true, placeholder: "0.5" },
      { kind: "setting", key: "enabledPages", label: "Enabled forms", advanced: true, placeholder: enabledForms.join(", ") },
    ],
  },
  google_adsense: {
    provider: "google_adsense",
    category: "ads",
    displayName: "Google AdSense",
    description: "AdSense publisher controls.",
    setupGuide: "Add the public publisher ID from AdSense. Ads remain disabled until the integration is active.",
    testDescription: "Validate publisher ID and ads.txt settings.",
    fields: [
      { kind: "credential", key: "publisher_id", label: "Publisher ID", required: true, publicClient: true },
      { kind: "setting", key: "adsTxtLine", label: "ads.txt line", advanced: true },
      { kind: "setting", key: "autoAdsEnabled", label: "Auto ads enabled", type: "select", advanced: true, options: booleanOptions() },
      { kind: "setting", key: "disabledPages", label: "Disabled pages list", advanced: true, placeholder: "/admin,/billing,/orders,/checkout" },
    ],
  },
  stripe_identity: verificationFields("stripe_identity", "Stripe Identity", ["secret_key", "webhook_secret"]),
  stripe_connect: verificationFields("stripe_connect", "Stripe Connect", ["secret_key", "webhook_secret"]),
  persona_placeholder: verificationFields("persona_placeholder", "Persona Placeholder", ["api_key", "template_id", "webhook_secret"]),
  checkr_placeholder: verificationFields("checkr_placeholder", "Checkr Placeholder", ["api_key", "webhook_secret"], [{ kind: "setting", key: "packageType", label: "Package type", required: true }]),
  kyc_provider: verificationFields("kyc_provider", "KYC Provider", ["api_key", "secret", "webhook_secret"]),
  background_check_provider: verificationFields("background_check_provider", "Background Check Provider", ["api_key", "secret", "webhook_secret"]),
  custom: {
    provider: "custom",
    category: "other",
    displayName: "Custom API",
    description: "Custom integration configuration.",
    setupGuide: "Use this for providers that do not have a first-class setup form yet.",
    testDescription: "Validate base URL and authentication shape.",
    fields: [
      { kind: "setting", key: "baseUrl", label: "Base URL", type: "url", required: true },
      { kind: "credential", key: "api_key", label: "API key or token", type: "password", required: true, secret: true },
      { kind: "setting", key: "authType", label: "Auth type", type: "select", required: true, options: [{ value: "bearer", label: "Bearer token" }, { value: "api_key", label: "API key" }, { value: "basic", label: "Basic auth" }] },
      { kind: "setting", key: "headersJson", label: "Headers JSON", type: "textarea", advanced: true },
      { kind: "setting", key: "testEndpoint", label: "Test endpoint", advanced: true },
      { kind: "setting", key: "timeoutMs", label: "Timeout", type: "number", advanced: true },
      { kind: "setting", key: "retryCount", label: "Retry count", type: "number", advanced: true },
    ],
  },
};

export function getProviderFormDefinition(provider: IntegrationProvider) {
  return providerFormRegistry[provider];
}

export function getProviderFields(provider: IntegrationProvider, advanced?: boolean) {
  return providerFormRegistry[provider].fields.filter((field) => Boolean(field.advanced) === Boolean(advanced));
}

export function requiredProviderFields(provider: IntegrationProvider) {
  return providerFormRegistry[provider].fields.filter((field) => field.required);
}

export function providerRequiredCredentialKeys(provider: IntegrationProvider) {
  return requiredProviderFields(provider)
    .filter((field) => field.kind === "credential")
    .map((field) => field.key);
}

export function providerRequiredSettingKeys(provider: IntegrationProvider) {
  return requiredProviderFields(provider)
    .filter((field) => field.kind === "setting")
    .map((field) => field.key);
}

export function generatedProviderValue(provider: IntegrationProvider, key: string, origin: string) {
  const definition = getProviderFormDefinition(provider);
  const field = definition.fields.find((item) => item.key === key);
  if (!field?.readOnlyGenerated) return "";
  if (field.key === "callbackUrl" && definition.generatedCallbackPath) {
    return new URL(definition.generatedCallbackPath, origin).toString();
  }
  return "";
}

function booleanOptions() {
  return [
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
  ];
}

function organizationTypeOptions() {
  return [
    { value: "household", label: "Household" },
    { value: "chef_business", label: "Chef" },
    { value: "home_catering", label: "Home Catering" },
    { value: "restaurant", label: "Restaurant" },
  ];
}

function mapsSibling(provider: IntegrationProvider, displayName: string, description: string, apiName: string): ProviderFormDefinition {
  return {
    provider,
    category: "maps",
    displayName,
    description,
    setupGuide: `Create a restricted server key in Google Cloud Console and enable ${apiName}.`,
    testDescription: `Validate ${apiName} configuration with a safe sample request.`,
    fields: [
      { kind: "credential", key: "server_api_key", label: "Server API Key", type: "password", required: true, secret: true },
      { kind: "setting", key: "defaultCountry", label: "Default country", placeholder: "US" },
      { kind: "setting", key: "allowedCountries", label: "Country allowlist", advanced: true, placeholder: "US,IN,AE" },
    ],
  };
}

function s3Fields(provider: IntegrationProvider, displayName: string, description: string): ProviderFormDefinition {
  return {
    provider,
    category: "storage",
    displayName,
    description,
    setupGuide: "Create a bucket and an IAM/access key with limited bucket permissions.",
    testDescription: "Upload, read, and delete a small temporary test object when configured.",
    fields: [
      { kind: "setting", key: "bucketName", label: "Bucket name", required: true },
      { kind: "setting", key: "region", label: "Region", required: true, placeholder: "us-east-1" },
      { kind: "credential", key: "access_key_id", label: "Access key ID", required: true, secret: true },
      { kind: "credential", key: "secret_access_key", label: "Secret access key", type: "password", required: true, secret: true },
      { kind: "setting", key: "endpoint", label: "Endpoint", type: "url", advanced: true },
      { kind: "setting", key: "forcePathStyle", label: "Force path style", type: "select", advanced: true, options: booleanOptions() },
      { kind: "setting", key: "publicBaseUrl", label: "Public base URL", type: "url", advanced: true },
      { kind: "setting", key: "signedUrlExpirationSeconds", label: "Signed URL expiration", type: "number", advanced: true },
      { kind: "setting", key: "maxUploadSizeMb", label: "Max upload size", type: "number", advanced: true },
      { kind: "setting", key: "allowedMimeTypes", label: "Allowed MIME types", advanced: true },
    ],
  };
}

function verificationFields(
  provider: IntegrationProvider,
  displayName: string,
  credentialKeys: string[],
  extraFields: ProviderFieldDefinition[] = [],
): ProviderFormDefinition {
  return {
    provider,
    category: "verification",
    displayName,
    description: `${displayName} verification provider settings.`,
    setupGuide: "Configure provider credentials only if this verification provider is enabled.",
    testDescription: "Validate required credentials and webhook readiness without submitting real applicant data.",
    fields: [
      ...credentialKeys.map((key) => ({
        kind: "credential" as const,
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        type: "password" as const,
        required: true,
        secret: true,
      })),
      ...extraFields,
    ],
  };
}
