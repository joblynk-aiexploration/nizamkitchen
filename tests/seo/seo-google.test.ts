import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationProvider, RobotsDirective, SeoScope } from "@prisma/client";

const { mockPrisma, mockConfig } = vi.hoisted(() => ({
  mockPrisma: {
    seoSetting: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    recipe: { findMany: vi.fn() },
    chefProfile: { findMany: vi.fn() },
    homeCateringProfile: { findMany: vi.fn() },
    organization: { findMany: vi.fn() },
    menuTemplate: { findMany: vi.fn() },
    featureFlag: { findFirst: vi.fn() },
  },
  mockConfig: {
    getActiveIntegration: vi.fn(),
    getPublicIntegrationConfig: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/config/platform-config-service", () => mockConfig);

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as adsTxt } from "@/app/ads.txt/route";
import {
  buildSeoMetadata,
  getGooglePlatformPublicConfig,
  getSecurePrivacyPublicConfig,
  recipeJsonLd,
  verifyRecaptcha,
} from "@/server/seo/seo-service";

describe("SEO/AEO and Google platform controls", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    delete process.env.NIZAMKITCHEN_SKIP_BUILD_DB;
    mockPrisma.seoSetting.findMany.mockResolvedValue([]);
    mockPrisma.seoSetting.findFirst.mockResolvedValue(null);
    mockPrisma.recipe.findMany.mockResolvedValue([]);
    mockPrisma.chefProfile.findMany.mockResolvedValue([]);
    mockPrisma.homeCateringProfile.findMany.mockResolvedValue([]);
    mockPrisma.organization.findMany.mockResolvedValue([]);
    mockPrisma.menuTemplate.findMany.mockResolvedValue([]);
    mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
    mockConfig.getActiveIntegration.mockResolvedValue(null);
    mockConfig.getPublicIntegrationConfig.mockResolvedValue(null);
  });

  it("renders global SEO metadata fallback from SeoSetting", async () => {
    mockPrisma.seoSetting.findFirst.mockResolvedValueOnce({
      metaTitle: "Global NizamKitchen title",
      metaDescription: "Global NizamKitchen description",
      canonicalUrl: "https://nizamkitchen.com/",
      robotsDirective: RobotsDirective.index_follow,
    });

    const metadata = await buildSeoMetadata({ path: "/" });
    expect(metadata.title).toBe("Global NizamKitchen title");
    expect(metadata.description).toBe("Global NizamKitchen description");
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("lets page SEO override global SEO", async () => {
    mockPrisma.seoSetting.findFirst.mockImplementation(async ({ where }) => {
      if (where.path === "/pricing") {
        return {
          metaTitle: "Pricing override",
          metaDescription: "Pricing override description",
          canonicalUrl: null,
          robotsDirective: RobotsDirective.index_follow,
        };
      }
      if (where.scope === SeoScope.global) {
        return { metaTitle: "Global title", metaDescription: "Global description", canonicalUrl: null, robotsDirective: RobotsDirective.index_follow };
      }
      return null;
    });

    const metadata = await buildSeoMetadata({ path: "/pricing" });
    expect(metadata.title).toBe("Pricing override");
    expect(metadata.description).toBe("Pricing override description");
  });

  it("recipe structured data does not include fake ratings", () => {
    const jsonLd = recipeJsonLd({ name: "Chicken Dum Biryani", description: "Layered biryani", servings: 6 });
    expect(JSON.stringify(jsonLd)).not.toMatch(/aggregateRating|review|ratingValue/i);
  });

  it("robots blocks private areas", () => {
    const policy = robots();
    expect(JSON.stringify(policy)).toContain("/admin/");
    expect(JSON.stringify(policy)).toContain("/orders/");
    expect(JSON.stringify(policy)).toContain("/api/");
  });

  it("sitemap includes public pages and excludes private app areas", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/pricing"))).toBe(true);
    expect(urls.some((url) => url.includes("/admin"))).toBe(false);
    expect(urls.some((url) => url.includes("/orders"))).toBe(false);
    expect(urls.some((url) => url.includes("/billing"))).toBe(false);
  });

  it("Search Console, Analytics, and AdSense config comes from public API vault values only", async () => {
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_search_console) return { credentials: { verification_meta_tag: '<meta name="google-site-verification" content="verify-123" />' }, settings: {} };
      if (provider === IntegrationProvider.google_analytics) return { credentials: { measurement_id: "G-ABC123" }, settings: { consentRequired: false } };
      if (provider === IntegrationProvider.secure_privacy) return null;
      if (provider === IntegrationProvider.google_adsense) return { credentials: { publisher_id: "ca-pub-123" }, settings: { publicAdScriptEnabled: true, adsTxtLine: "google.com, pub-123, DIRECT, f08c47fec0942fa0" } };
      return null;
    });

    const config = await getGooglePlatformPublicConfig();
    expect(config.searchConsoleVerification).toBe("verify-123");
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsConsentRequired).toBe(true);
    expect(config.consentManagementEnabled).toBe(true);
    expect(config.adsenseEnabled).toBe(true);
    expect(config.adsTxtLine).toContain("pub-123");
  });

  it("requires consent for Analytics when the Secure Privacy fallback is active", async () => {
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_analytics) return { credentials: { measurement_id: "G-DEFAULT" }, settings: {} };
      return null;
    });

    const config = await getGooglePlatformPublicConfig();
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsConsentRequired).toBe(true);
    expect(config.consentManagementEnabled).toBe(true);
  });

  it("uses NEXT_PUBLIC_GOOGLE_ANALYTICS_ID as a single fallback when API Management has no Analytics value", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-D2668ZZ80C";
    mockConfig.getPublicIntegrationConfig.mockResolvedValue(null);

    const config = await getGooglePlatformPublicConfig();
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsMeasurementId).toBe("G-D2668ZZ80C");
    expect(config.analyticsConsentRequired).toBe(true);
    expect(config.consentManagementEnabled).toBe(true);
  });

  it("uses the Analytics fallback during production builds when database reads are skipped", async () => {
    process.env.NIZAMKITCHEN_SKIP_BUILD_DB = "1";
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-D2668ZZ80C";

    const config = await getGooglePlatformPublicConfig();
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsMeasurementId).toBe("G-D2668ZZ80C");
    expect(config.analyticsConsentRequired).toBe(true);
    expect(mockConfig.getPublicIntegrationConfig).not.toHaveBeenCalled();
  });

  it("lets the global cookie privacy consent feature flag disable CMP, consent mode, and Analytics", async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({ enabled: false });
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_search_console) {
        return { credentials: { verification_meta_tag: '<meta name="google-site-verification" content="verify-123" />' }, settings: {} };
      }
      if (provider === IntegrationProvider.google_analytics) return { credentials: { measurement_id: "G-DISABLED" }, settings: {} };
      if (provider === IntegrationProvider.secure_privacy) {
        return {
          credentials: {},
          settings: {
            scriptUrl: "https://app.secureprivacy.ai/script/6a265d6522609752e3d645f1.js",
            consentModeEnabled: true,
            googleAnalyticsConsentEnabled: true,
          },
        };
      }
      return null;
    });

    await expect(getSecurePrivacyPublicConfig()).resolves.toEqual({
      enabled: false,
      scriptUrl: undefined,
      consentModeEnabled: false,
      googleAnalyticsIntegrationEnabled: false,
    });

    await expect(getGooglePlatformPublicConfig()).resolves.toEqual(expect.objectContaining({
      searchConsoleVerification: "verify-123",
      analyticsEnabled: false,
      analyticsConsentRequired: false,
      consentManagementEnabled: false,
      consentModeEnabled: false,
      cmpAnalyticsIntegrationEnabled: false,
      adsenseEnabled: false,
    }));
  });

  it("keeps API Management as the primary Analytics measurement source over the env fallback", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-D2668ZZ80C";
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_analytics) return { credentials: { measurement_id: "G-ADMIN123" }, settings: {} };
      return null;
    });

    const config = await getGooglePlatformPublicConfig();
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsMeasurementId).toBe("G-ADMIN123");
  });

  it("loads Secure Privacy from API Management and requires Analytics consent mode when enabled", async () => {
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_analytics) return { credentials: { measurement_id: "G-CMP" }, settings: {} };
      if (provider === IntegrationProvider.secure_privacy) {
        return {
          credentials: {},
          settings: {
            scriptUrl: "https://app.secureprivacy.ai/script/6a265d6522609752e3d645f1.js",
            consentModeEnabled: true,
            googleAnalyticsConsentEnabled: true,
          },
        };
      }
      return null;
    });

    const config = await getGooglePlatformPublicConfig();
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsConsentRequired).toBe(true);
    expect(config.consentManagementEnabled).toBe(true);
    expect(config.consentModeEnabled).toBe(true);
    expect(config.cmpAnalyticsIntegrationEnabled).toBe(true);
  });

  it("supports the legacy Secure Privacy Google Analytics integration setting name", async () => {
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_analytics) return { credentials: { measurement_id: "G-CMP" }, settings: {} };
      if (provider === IntegrationProvider.secure_privacy) {
        return {
          credentials: {},
          settings: {
            scriptUrl: "https://app.secureprivacy.ai/script/6a265d6522609752e3d645f1.js",
            consentModeEnabled: true,
            googleAnalyticsIntegrationEnabled: true,
          },
        };
      }
      return null;
    });

    const config = await getGooglePlatformPublicConfig();
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsConsentRequired).toBe(true);
    expect(config.cmpAnalyticsIntegrationEnabled).toBe(true);
  });

  it("rejects invalid Secure Privacy script URLs and disabled provider config loads nothing", async () => {
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.secure_privacy) {
        return { credentials: {}, settings: { scriptUrl: "https://evil.example/script.js", consentModeEnabled: true } };
      }
      return null;
    });

    const { getSecurePrivacyPublicConfig } = await import("@/server/seo/seo-service");
    await expect(getSecurePrivacyPublicConfig()).resolves.toEqual({
      enabled: false,
      scriptUrl: undefined,
      consentModeEnabled: false,
      googleAnalyticsIntegrationEnabled: false,
    });
  });

  it("Analytics can require consent before public scripts render", async () => {
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_analytics) {
        return { credentials: { measurement_id: "G-CONSENT" }, settings: { consentRequired: true } };
      }
      return null;
    });

    const config = await getGooglePlatformPublicConfig();
    expect(config.analyticsEnabled).toBe(true);
    expect(config.analyticsConsentRequired).toBe(true);
  });

  it("ads.txt route returns configured publisher line only when enabled", async () => {
    mockConfig.getPublicIntegrationConfig.mockImplementation(async (provider: IntegrationProvider) => {
      if (provider === IntegrationProvider.google_adsense) {
        return { credentials: { publisher_id: "ca-pub-123" }, settings: { publicAdScriptEnabled: true, adsTxtLine: "google.com, pub-123, DIRECT, f08c47fec0942fa0" } };
      }
      return null;
    });

    const response = await adsTxt();
    await expect(response.text()).resolves.toContain("pub-123");
  });

  it("reCAPTCHA missing config does not crash", async () => {
    await expect(verifyRecaptcha({ page: "register" })).resolves.toEqual(expect.objectContaining({ ok: true, skipped: true }));
  });

  it("reCAPTCHA enabled verifies server-side with mocked provider", async () => {
    mockConfig.getActiveIntegration.mockResolvedValue({
      credentials: [{ keyName: "secret_key", value: "secret", isPublicClientValue: false }, { keyName: "site_key", value: "site", isPublicClientValue: true }],
      settings: [{ settingKey: "enabledPages", settingValueJson: "register", isSecret: false }, { settingKey: "scoreThreshold", settingValueJson: "0.5", isSecret: false }],
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true, score: 0.9 })));

    await expect(verifyRecaptcha({ page: "register", token: "token" })).resolves.toEqual(expect.objectContaining({ ok: true }));
    vi.unstubAllGlobals();
  });

  it("admin SEO pages are platform owner protected and Google IDs are not hardcoded", async () => {
    const page = await fs.readFile("src/app/(app)/admin/seo/google/page.tsx", "utf8");
    const rootLayout = await fs.readFile("src/app/layout.tsx", "utf8");
    const publicLayout = await fs.readFile("src/app/(public)/layout.tsx", "utf8");
    const scripts = await fs.readFile("src/components/seo/google-platform-scripts.tsx", "utf8");
    const googleAnalytics = await fs.readFile("src/components/analytics/GoogleAnalytics.tsx", "utf8");
    const tracker = await fs.readFile("src/components/seo/google-analytics-tracker.tsx", "utf8");
    const analyticsHelper = await fs.readFile("src/lib/analytics.ts", "utf8");
    const securePrivacyScripts = await fs.readFile("src/components/privacy/secure-privacy-scripts.tsx", "utf8");
    const securePrivacyWidgetCleanup = await fs.readFile("src/components/privacy/secure-privacy-widget-cleanup.tsx", "utf8");
    const securePrivacyBridge = await fs.readFile("src/components/privacy/secure-privacy-consent-bridge.tsx", "utf8");
    const cookiePolicyContent = await fs.readFile("src/components/privacy/cookie-policy-content.tsx", "utf8");
    const footer = await fs.readFile("src/app/(public)/layout.tsx", "utf8");
    expect(page).toContain("requirePlatformRole([\"platform_owner\"])");
    expect(rootLayout).toContain("GooglePlatformScripts");
    expect(rootLayout).toContain("SecurePrivacyScripts");
    expect(rootLayout.match(/SecurePrivacyScripts/g)?.length).toBe(2);
    expect(publicLayout).not.toContain("GooglePlatformScripts");
    expect(scripts).toContain("GoogleAnalytics");
    expect(scripts).toContain("getGooglePlatformPublicConfig");
    expect(scripts).toContain("config.analyticsEnabled && config.analyticsMeasurementId");
    expect(googleAnalytics).toContain("https://www.googletagmanager.com/gtag/js?id=");
    expect(googleAnalytics.match(/googletagmanager/g)?.length).toBe(1);
    expect(googleAnalytics.match(/nizamkitchen-google-analytics/g)?.length).toBe(1);
    expect(googleAnalytics).toContain("send_page_view: false");
    expect(googleAnalytics).toContain("window.NizamKitchenAnalyticsMeasurementId");
    expect(googleAnalytics).toContain("if (!measurementId) return null;");
    expect(tracker).toContain("trackPageView");
    expect(analyticsHelper).toContain("\"page_view\"");
    expect(analyticsHelper).toContain("function canTrackAnalytics");
    expect(analyticsHelper).toContain("function getGoogleAnalyticsMeasurementId");
    expect(analyticsHelper).toContain("function trackPageView");
    expect(analyticsHelper).toContain("function trackEvent");
    expect(securePrivacyScripts).toContain("nizamkitchen-secure-privacy");
    expect(securePrivacyScripts.match(/nizamkitchen-secure-privacy/g)?.length).toBe(1);
    expect(securePrivacyScripts).toContain("analytics_storage: 'denied'");
    expect(securePrivacyWidgetCleanup).toContain("ifrmCookieBanner");
    expect(securePrivacyWidgetCleanup).toContain("ifrmTrustBadge");
    expect(securePrivacyWidgetCleanup).toContain("nizamkitchenHiddenLauncher");
    expect(securePrivacyBridge).toContain("analytics_storage: consent.analytics ? \"granted\" : \"denied\"");
    expect(securePrivacyBridge).toContain("SecurePrivacyConsentChanged");
    expect(tracker).toContain("if (requiresConsent && !analyticsConsentGranted()) return;");
    expect(footer).toContain("/cookie-policy");
    expect(footer).not.toContain("ManageCookiePreferencesButton");
    expect(cookiePolicyContent).toContain("ManageCookiePreferencesButton");
    expect(`${page}\n${rootLayout}\n${publicLayout}\n${scripts}\n${googleAnalytics}\n${tracker}\n${analyticsHelper}\n${securePrivacyScripts}\n${securePrivacyBridge}`).not.toMatch(/ca-pub-\\d{6,}/);
  });

  it("tracks required GA4 events through the global tracker and action redirect markers", async () => {
    const tracker = await fs.readFile("src/components/seo/google-analytics-tracker.tsx", "utf8");
    const events = await fs.readFile("src/lib/analytics/events.ts", "utf8");
    const recipePage = await fs.readFile("src/app/(app)/recipes/[id]/page.tsx", "utf8");
    const mealPlanActions = await fs.readFile("src/app/(app)/meal-plans/actions.ts", "utf8");
    const homeChefActions = await fs.readFile("src/app/(app)/home-chef/actions.ts", "utf8");
    const chefActions = await fs.readFile("src/app/(app)/chef/actions.ts", "utf8");
    const orderActions = await fs.readFile("src/app/(app)/orders/actions.ts", "utf8");
    const loginRoute = await fs.readFile("src/app/api/auth/login/route.ts", "utf8");
    const registerRoute = await fs.readFile("src/app/api/auth/register/route.ts", "utf8");

    for (const eventName of [
      "page_view",
      "sign_up",
      "login",
      "recipe_view",
      "add_to_my_recipes",
      "meal_plan_created",
      "grocery_list_generated",
      "home_chef_request_created",
      "home_chef_request_confirmed",
      "caterer_profile_view",
      "restaurant_profile_view",
      "checkout_started",
      "payment_completed",
      "subscription_purchased",
    ]) {
      expect(`${tracker}\n${events}\n${await fs.readFile("src/lib/analytics.ts", "utf8")}`).toContain(eventName);
    }

    expect(recipePage).toContain("add_to_my_recipes");
    expect(mealPlanActions).toContain("meal_plan_created");
    expect(mealPlanActions).toContain("grocery_list_generated");
    expect(homeChefActions).toContain("home_chef_request_created");
    expect(chefActions).toContain("home_chef_request_confirmed");
    expect(orderActions).toContain("checkout_started");
    expect(loginRoute).toContain("\"login\"");
    expect(registerRoute).toContain("\"sign_up\"");
  });
});
