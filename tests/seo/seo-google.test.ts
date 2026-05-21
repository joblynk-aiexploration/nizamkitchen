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
  recipeJsonLd,
  verifyRecaptcha,
} from "@/server/seo/seo-service";

describe("SEO/AEO and Google platform controls", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.seoSetting.findMany.mockResolvedValue([]);
    mockPrisma.seoSetting.findFirst.mockResolvedValue(null);
    mockPrisma.recipe.findMany.mockResolvedValue([]);
    mockPrisma.chefProfile.findMany.mockResolvedValue([]);
    mockPrisma.homeCateringProfile.findMany.mockResolvedValue([]);
    mockPrisma.organization.findMany.mockResolvedValue([]);
    mockPrisma.menuTemplate.findMany.mockResolvedValue([]);
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
      if (provider === IntegrationProvider.google_adsense) return { credentials: { publisher_id: "ca-pub-123" }, settings: { publicAdScriptEnabled: true, adsTxtLine: "google.com, pub-123, DIRECT, f08c47fec0942fa0" } };
      return null;
    });

    const config = await getGooglePlatformPublicConfig();
    expect(config.searchConsoleVerification).toBe("verify-123");
    expect(config.analyticsEnabled).toBe(true);
    expect(config.adsenseEnabled).toBe(true);
    expect(config.adsTxtLine).toContain("pub-123");
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
    const layout = await fs.readFile("src/app/(public)/layout.tsx", "utf8");
    expect(page).toContain("requirePlatformRole([\"platform_owner\"])");
    expect(layout).toContain("GooglePlatformScripts");
    expect(`${page}\n${layout}`).not.toMatch(/G-[A-Z0-9]{4,}|ca-pub-\\d{6,}/);
  });
});
