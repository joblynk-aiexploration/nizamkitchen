import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationProvider, UserStatus, type PlatformRole } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    platformIntegration: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    platformIntegrationCredential: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    platformIntegrationSetting: {
      upsert: vi.fn(),
    },
    platformIntegrationTestLog: {
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "platform-config-test-encryption-key",
    APP_URL: "http://localhost:3000",
    GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
    GOOGLE_OAUTH_CALLBACK_URL: "",
    FACEBOOK_OAUTH_APP_ID: "facebook-app-id",
    FACEBOOK_OAUTH_APP_SECRET: "facebook-app-secret",
    FACEBOOK_OAUTH_CALLBACK_URL: "",
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { createAuditEvent } from "@/server/audit";
import { decryptGatewayCredential, encryptGatewayCredential } from "@/server/payments/credentials";
import {
  getActiveIntegration,
  deletePlatformIntegration,
  getPlatformIntegration,
  getPublicIntegrationConfig,
  importOAuthIntegrationFromEnv,
  listIntegrationTemplates,
  listPlatformIntegrations,
  requireIntegration,
  runPlatformIntegrationTest,
  savePlatformIntegration,
  savePlatformIntegrationCredential,
} from "@/server/config/platform-config-service";

function adminSession(role: PlatformRole | null = "platform_owner", countryCodes: string[] = ["US"]) {
  return {
    user: { id: "admin-1", status: UserStatus.active, platformRole: role },
    countryAssignments: countryCodes.map((countryCode) => ({ countryCode })),
  };
}

describe("platform configuration vault", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.platformIntegration.create.mockImplementation(async ({ data }) => ({
      id: "integration-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTestedAt: null,
      lastTestStatus: "not_tested",
      lastTestMessage: null,
      ...data,
    }));
    mockPrisma.platformIntegration.update.mockImplementation(async ({ data, where }) => ({
      id: where.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTestedAt: data.lastTestedAt ?? null,
      lastTestStatus: data.lastTestStatus ?? "not_tested",
      lastTestMessage: data.lastTestMessage ?? null,
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth",
      status: "active",
      environment: "production",
      countryCode: "US",
      region: null,
      isGlobal: true,
      isDefault: true,
      createdById: "admin-1",
      updatedById: "admin-1",
      ...data,
    }));
    mockPrisma.platformIntegration.delete.mockImplementation(async ({ where }) => ({ id: where.id }));
    mockPrisma.platformIntegration.findFirst.mockResolvedValue(null);
    mockPrisma.platformIntegrationCredential.create.mockImplementation(async ({ data }) => ({
      id: "credential-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    mockPrisma.platformIntegrationTestLog.create.mockImplementation(async ({ data }) => ({
      id: "test-1",
      createdAt: new Date(),
      ...data,
    }));
  });

  it("encrypts integration secrets at rest and masks previews", async () => {
    mockPrisma.platformIntegration.findUnique.mockResolvedValue({
      id: "integration-1",
      provider: "google_oauth",
      countryCode: "US",
    });
    mockPrisma.platformIntegrationCredential.findUnique.mockResolvedValue(null);

    await savePlatformIntegrationCredential(adminSession(), {
      integrationId: "integration-1",
      keyName: "client_secret",
      secretValue: "google-secret-1234",
      isPublicClientValue: false,
    });

    const saved = mockPrisma.platformIntegrationCredential.create.mock.calls[0][0].data;
    expect(saved.encryptedValue).not.toContain("google-secret-1234");
    expect(decryptGatewayCredential(saved.encryptedValue)).toBe("google-secret-1234");
    expect(saved.valuePreview).toMatch(/\*\*\*\*1234$/);
  });

  it("never returns server-only secrets in public config", async () => {
    const encryptedClientId = encryptGatewayCredential("public-client-id");
    const encryptedClientSecret = encryptGatewayCredential("private-client-secret");
    mockPrisma.platformIntegration.findMany.mockResolvedValue([
      {
        id: "integration-1",
        provider: "google_oauth",
        category: "auth",
        displayName: "Google OAuth",
        description: null,
        status: "active",
        environment: "production",
        countryCode: null,
        region: null,
        isGlobal: true,
        isDefault: true,
        createdById: "admin-1",
        updatedById: "admin-1",
        lastTestedAt: null,
        lastTestStatus: "not_tested",
        lastTestMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        credentials: [
          {
            keyName: "client_id",
            encryptedValue: encryptedClientId,
            isPublicClientValue: true,
          },
          {
            keyName: "client_secret",
            encryptedValue: encryptedClientSecret,
            isPublicClientValue: false,
          },
        ],
        settings: [{ settingKey: "callbackUrl", settingValueJson: "https://example.test/callback", isSecret: false }],
      },
    ]);

    const publicConfig = await getPublicIntegrationConfig(IntegrationProvider.google_oauth);
    expect(publicConfig?.credentials.client_id).toBe("public-client-id");
    expect(publicConfig?.credentials).not.toHaveProperty("client_secret");
  });

  it("allows platform owner to create an integration and records audit logs", async () => {
    await savePlatformIntegration(adminSession(), {
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth",
      status: "active",
      environment: "production",
      countryCode: "US",
      isGlobal: false,
      isDefault: true,
    });

    expect(mockPrisma.platformIntegration.create).toHaveBeenCalled();
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "platform_integration.created" }));
  });

  it("allows platform owner to manage every supported integration template", async () => {
    const templates = listIntegrationTemplates();

    for (const template of templates) {
      await savePlatformIntegration(adminSession(), {
        provider: template.provider,
        category: template.category,
        displayName: template.displayName,
        status: "active",
        environment: "production",
        countryCode: template.provider === "custom" ? "US" : "",
        isGlobal: template.provider !== "custom",
        isDefault: true,
      });
    }

    expect(mockPrisma.platformIntegration.create).toHaveBeenCalledTimes(templates.length);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "platform_integration.created" }));
  });

  it("allows platform owner to delete an API integration and records audit logs", async () => {
    mockPrisma.platformIntegration.findUnique.mockResolvedValue({
      id: "integration-1",
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth",
      countryCode: null,
      environment: "production",
    });

    await deletePlatformIntegration(adminSession(), "integration-1");

    expect(mockPrisma.platformIntegration.delete).toHaveBeenCalledWith({ where: { id: "integration-1" } });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "platform_integration.deleted_or_archived",
      targetId: "integration-1",
    }));
  });

  it("imports Google OAuth from local env into encrypted platform configuration", async () => {
    mockPrisma.platformIntegration.findUnique.mockResolvedValue({
      id: "integration-1",
      provider: "google_oauth",
      countryCode: null,
    });
    mockPrisma.platformIntegrationCredential.findUnique.mockResolvedValue(null);
    mockPrisma.platformIntegrationSetting.upsert.mockImplementation(async ({ create, update }) => ({
      id: "setting-1",
      ...create,
      ...update,
    }));

    const integration = await importOAuthIntegrationFromEnv(adminSession(), IntegrationProvider.google_oauth);

    expect(integration.id).toBe("integration-1");
    expect(mockPrisma.platformIntegration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: "google_oauth",
        status: "active",
        environment: "development",
      }),
    }));
    expect(mockPrisma.platformIntegrationCredential.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        keyName: "client_id",
        isPublicClientValue: true,
      }),
    }));
    expect(mockPrisma.platformIntegrationCredential.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        keyName: "client_secret",
        isPublicClientValue: false,
      }),
    }));
    expect(mockPrisma.platformIntegrationSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        settingKey: "callbackUrl",
        settingValueJson: "http://localhost:3000/api/auth/oauth/google/callback",
      }),
    }));
  });

  it("blocks non-admin users from managing integrations", async () => {
    await expect(savePlatformIntegration(adminSession(null), {
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth",
      status: "active",
      environment: "production",
      countryCode: "US",
      isGlobal: false,
      isDefault: true,
    })).rejects.toThrow();
  });

  it("blocks country managers from managing API configuration", async () => {
    await expect(savePlatformIntegration(adminSession("country_manager", ["US"]), {
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth India",
      status: "active",
      environment: "production",
      countryCode: "IN",
      isGlobal: false,
      isDefault: true,
    })).rejects.toThrow();
  });

  it("returns only active integrations and cleanly reports missing setup", async () => {
    mockPrisma.platformIntegration.findMany.mockResolvedValue([]);
    expect(await getActiveIntegration(IntegrationProvider.smtp)).toBeNull();
    await expect(requireIntegration(IntegrationProvider.smtp)).rejects.toThrow("smtp is not configured yet.");
    expect(await getPublicIntegrationConfig(IntegrationProvider.smtp)).toBeNull();
  });

  it("keeps encrypted values out of detail queries and blocks country manager listings", async () => {
    mockPrisma.platformIntegration.findMany.mockResolvedValue([]);
    await expect(listPlatformIntegrations(adminSession("country_manager", ["US"]))).rejects.toThrow();

    mockPrisma.platformIntegration.findUnique.mockResolvedValue({
      id: "integration-1",
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth",
      description: null,
      status: "active",
      environment: "production",
      countryCode: "US",
      region: null,
      isGlobal: true,
      isDefault: true,
      createdById: "admin-1",
      updatedById: "admin-1",
      lastTestedAt: null,
      lastTestStatus: "not_tested",
      lastTestMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [],
      settings: [],
      testLogs: [],
    });
    await getPlatformIntegration(adminSession(), "integration-1");
    const credentialSelect = mockPrisma.platformIntegration.findUnique.mock.calls.at(-1)?.[0].include.credentials.select;
    expect(credentialSelect.encryptedValue).toBeUndefined();
  });

  it("does not use disabled integrations and logs safe test results", async () => {
    mockPrisma.platformIntegration.findUnique.mockResolvedValue({
      id: "integration-1",
      provider: "youtube_data",
      category: "marketplace",
      displayName: "YouTube Data",
      description: null,
      status: "disabled",
      environment: "production",
      countryCode: "US",
      region: null,
      isGlobal: false,
      isDefault: true,
      createdById: "admin-1",
      updatedById: "admin-1",
      lastTestedAt: null,
      lastTestStatus: "not_tested",
      lastTestMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [],
      settings: [],
    });

    await runPlatformIntegrationTest(adminSession(), { integrationId: "integration-1", testType: "youtube_key" });
    expect(mockPrisma.platformIntegrationTestLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "failed",
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "platform_integration.tested" }));
  });

  it("flags OAuth callback URLs that point to the start route", async () => {
    mockPrisma.platformIntegration.findUnique.mockResolvedValue({
      id: "integration-1",
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth",
      description: null,
      status: "active",
      environment: "development",
      countryCode: null,
      region: null,
      isGlobal: true,
      isDefault: true,
      createdById: "admin-1",
      updatedById: "admin-1",
      lastTestedAt: null,
      lastTestStatus: "not_tested",
      lastTestMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [
        { keyName: "client_id", encryptedValue: encryptGatewayCredential("client-id"), isPublicClientValue: true },
        { keyName: "client_secret", encryptedValue: encryptGatewayCredential("client-secret"), isPublicClientValue: false },
      ],
      settings: [
        {
          settingKey: "callbackUrl",
          settingValueJson: "http://localhost:3000/api/auth/oauth/google/start?flow=register",
          isSecret: false,
        },
      ],
    });

    await runPlatformIntegrationTest(adminSession(), { integrationId: "integration-1", testType: "oauth_config" });

    expect(mockPrisma.platformIntegrationTestLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "failed",
        message: expect.stringContaining("Do not use the /start URL"),
      }),
    }));
  });

  it("allows localhost OAuth callbacks while the app is running locally", async () => {
    mockPrisma.platformIntegration.findUnique.mockResolvedValue({
      id: "integration-1",
      provider: "google_oauth",
      category: "auth",
      displayName: "Google OAuth",
      description: null,
      status: "active",
      environment: "production",
      countryCode: null,
      region: null,
      isGlobal: true,
      isDefault: true,
      createdById: "admin-1",
      updatedById: "admin-1",
      lastTestedAt: null,
      lastTestStatus: "not_tested",
      lastTestMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [
        { keyName: "client_id", encryptedValue: encryptGatewayCredential("client-id"), isPublicClientValue: true },
        { keyName: "client_secret", encryptedValue: encryptGatewayCredential("client-secret"), isPublicClientValue: false },
      ],
      settings: [
        {
          settingKey: "callbackUrl",
          settingValueJson: "http://localhost:3000/api/auth/oauth/google/callback",
          isSecret: false,
        },
      ],
    });

    await runPlatformIntegrationTest(adminSession(), { integrationId: "integration-1", testType: "oauth_config" });

    expect(mockPrisma.platformIntegrationTestLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "success",
        message: expect.stringContaining("Configuration saved and validated"),
      }),
    }));
  });

  it("ships templates and admin pages without exposing secret values in source", () => {
    const templates = listIntegrationTemplates();
    expect(templates.find((template) => template.provider === "google_oauth")?.serverCredentialKeys).toContain("client_secret");
    expect(templates.map((template) => template.provider)).toEqual(expect.arrayContaining([
      "google_maps",
      "google_places",
      "google_geocoding",
      "google_oauth",
      "facebook_oauth",
      "google_analytics",
      "secure_privacy",
      "google_search_console",
      "google_recaptcha",
      "google_adsense",
      "youtube_data",
      "aws_s3",
      "s3_compatible",
      "smtp",
      "stripe",
      "paypal",
      "google_pay",
      "stripe_identity",
      "stripe_connect",
      "persona_placeholder",
      "checkr_placeholder",
      "kyc_provider",
      "background_check_provider",
      "custom",
    ]));

    const overviewPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/page.tsx"), "utf8");
    const detailPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/[id]/page.tsx"), "utf8");
    const newPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/new/page.tsx"), "utf8");
    const providerPicker = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/new/provider-picker.tsx"), "utf8");
    const categoriesPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/categories/page.tsx"), "utf8");
    const publicKeysPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/public-keys/page.tsx"), "utf8");
    const sidebar = fs.readFileSync(path.join(process.cwd(), "src/components/admin/admin-sidebar.tsx"), "utf8");
    expect(overviewPage).toContain("requirePlatformRole([\"platform_owner\"])");
    expect(overviewPage).toContain("Google sign-in");
    expect(overviewPage).toContain("Configure ${item.name}");
    expect(overviewPage).toContain("Import from local env");
    expect(newPage).toContain("IntegrationProvider.google_oauth");
    expect(newPage).toContain("GOOGLE_OAUTH_CLIENT_ID");
    expect(newPage).toContain("GOOGLE_OAUTH_CLIENT_SECRET");
    expect(newPage).toContain("GOOGLE_OAUTH_CALLBACK_URL");
    expect(newPage).toContain("createApiWithSetupAction");
    expect(providerPicker).toContain("Selecting an API type updates the required setup fields below.");
    expect(categoriesPage).toContain("provider=${template.provider}");
    expect(detailPage).toContain("Replace saved value");
    expect(detailPage).toContain("Provider-specific API setup");
    expect(detailPage).toContain("Advanced settings");
    expect(detailPage).toContain("Developer details");
    expect(detailPage).toContain("Delete API");
    expect(publicKeysPage).toContain("Public API keys");
    expect(detailPage).not.toContain("encryptedValue");
    expect(sidebar).toContain("API Management");
    expect(sidebar).not.toContain("Configuration Vault");
    expect(sidebar).not.toContain("Masked Secrets");
  });
});
