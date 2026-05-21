import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationProvider, UserStatus, type PlatformRole } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    platformIntegration: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { createAuditEvent } from "@/server/audit";
import { decryptGatewayCredential, encryptGatewayCredential } from "@/server/payments/credentials";
import {
  getActiveIntegration,
  getPlatformIntegration,
  getPublicIntegrationConfig,
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

  it("ships templates and admin pages without exposing secret values in source", () => {
    const templates = listIntegrationTemplates();
    expect(templates.find((template) => template.provider === "google_oauth")?.serverCredentialKeys).toContain("client_secret");
    expect(templates.map((template) => template.provider)).toEqual(expect.arrayContaining([
      "google_maps",
      "google_places",
      "google_geocoding",
      "google_oauth",
      "facebook_oauth",
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
      "custom",
    ]));

    const overviewPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/page.tsx"), "utf8");
    const detailPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/[id]/page.tsx"), "utf8");
    const publicKeysPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/public-keys/page.tsx"), "utf8");
    const sidebar = fs.readFileSync(path.join(process.cwd(), "src/components/admin/admin-sidebar.tsx"), "utf8");
    expect(overviewPage).toContain("requirePlatformRole([\"platform_owner\"])");
    expect(detailPage).toContain("Save / rotate credential");
    expect(publicKeysPage).toContain("Public API keys");
    expect(detailPage).not.toContain("encryptedValue");
    expect(sidebar).toContain("API Management");
    expect(sidebar).not.toContain("Configuration Vault");
    expect(sidebar).not.toContain("Masked Secrets");
  });
});
