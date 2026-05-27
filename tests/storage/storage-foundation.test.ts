import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus, type PlatformRole } from "@prisma/client";

const { mockPrisma, mockGetActiveIntegration } = vi.hoisted(() => ({
  mockGetActiveIntegration: vi.fn(),
  mockPrisma: {
    storageConfiguration: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    storageFile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    storageFileAccessLog: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "storage-test-encryption-key-that-is-long-enough",
    NODE_ENV: "test",
    DEPLOYMENT_ENVIRONMENT: "test",
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/server/config/platform-config-service", () => ({ getActiveIntegration: mockGetActiveIntegration }));

import { decryptGatewayCredential } from "@/server/payments/credentials";
import { storageUploadSchema, validateFileInput } from "@/server/storage/file-validation";
import { buildStorageObjectKey } from "@/server/storage/storage-keys";
import { canAccessStorageFile } from "@/server/storage/storage-permissions";
import { archiveDeletedStorageFiles, getActiveStorageConfiguration, getStorageMaintenanceReport, listStorageConfigurations, saveStorageConfiguration } from "@/server/storage/storage-service";

function adminSession(role: PlatformRole | null = "platform_owner") {
  return {
    user: { id: "admin-1", status: UserStatus.active, platformRole: role },
    activeOrganization: { id: "org-1", countryCode: "US", organizationType: "household" },
    activeMembership: { role: "org_owner", status: "active" },
    countryAssignments: [{ countryCode: "US" }],
  };
}

describe("storage foundation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.storageConfiguration.create.mockImplementation(async ({ data }) => ({ id: "storage-1", ...data }));
    mockPrisma.storageConfiguration.findMany.mockResolvedValue([]);
    mockPrisma.storageConfiguration.findFirst.mockResolvedValue(null);
    mockPrisma.storageFile.updateMany.mockResolvedValue({ count: 0 });
    mockGetActiveIntegration.mockResolvedValue(null);
  });

  it("encrypts S3 credentials and never returns full secrets in configuration listings", async () => {
    await saveStorageConfiguration(adminSession(), {
      provider: "aws_s3",
      displayName: "AWS S3",
      status: "active",
      bucketName: "nizam-prod",
      region: "us-east-1",
      accessKeyId: "AKIASTORAGEEXAMPLE1",
      secretAccessKey: "storage-secret-value",
      signedUrlExpiresInSeconds: 900,
      maxUploadSizeBytes: 10485760,
      allowedMimeTypes: "image/jpeg,application/pdf",
    });
    const saved = mockPrisma.storageConfiguration.create.mock.calls[0][0].data;
    expect(saved.encryptedSecretAccessKey).not.toContain("storage-secret-value");
    expect(decryptGatewayCredential(saved.encryptedSecretAccessKey)).toBe("storage-secret-value");

    mockPrisma.storageConfiguration.findMany.mockResolvedValue([{ ...saved, id: "storage-1", createdAt: new Date(), updatedAt: new Date(), lastTestStatus: "not_tested", lastTestedAt: null, lastTestMessage: null }]);
    const configs = await listStorageConfigurations();
    expect(JSON.stringify(configs)).not.toContain("storage-secret-value");
    expect(configs[0].secretAccessKeyConfigured).toBe(true);
  });

  it("blocks non-admin storage configuration changes", async () => {
    await expect(saveStorageConfiguration(adminSession(null as never), {
      provider: "aws_s3",
      displayName: "AWS S3",
      status: "active",
      bucketName: "nizam-prod",
    })).rejects.toThrow();
  });

  it("uses Platform API Management S3 records when legacy storage configuration is empty", async () => {
    mockGetActiveIntegration.mockResolvedValueOnce({
      id: "integration-s3",
      provider: "aws_s3",
      displayName: "AWS S3",
      createdById: "admin-1",
      updatedById: "admin-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      lastTestedAt: null,
      lastTestStatus: "success",
      lastTestMessage: null,
      settings: [
        { settingKey: "bucketName", settingValueJson: "nizam-prod", isSecret: false },
        { settingKey: "region", settingValueJson: "us-east-2", isSecret: false },
        { settingKey: "maxUploadSizeMb", settingValueJson: "25", isSecret: false },
      ],
      credentials: [
        { keyName: "access_key_id", value: "AKIASTORAGEEXAMPLE1", isPublicClientValue: false },
        { keyName: "secret_access_key", value: "storage-secret-value", isPublicClientValue: false },
      ],
    });

    const config = await getActiveStorageConfiguration();

    expect(config.id).toBe("integration-s3");
    expect(config.bucketName).toBe("nizam-prod");
    expect(config.region).toBe("us-east-2");
    expect(config.accessKeyId).toBe("AKIASTORAGEEXAMPLE1");
    expect(config.secretAccessKey).toBe("storage-secret-value");
    expect(config.maxUploadSizeBytes).toBe(25 * 1024 * 1024);
  });

  it("generates safe object keys and strips traversal input", () => {
    const key = buildStorageObjectKey({
      countryCode: "US",
      organizationId: "org_123",
      module: "menus",
      entityType: "menuItem",
      entityId: "../evil",
      purpose: "menu_item_photo",
      fileId: "file-1",
      originalFilename: "biryani ../photo.JPG",
    });
    expect(key).toContain("nizamkitchen/test/US/org_123/menus/menuItem/evil/menu_item_photo/file-1-photo.jpg");
    expect(key).not.toContain("..");
  });

  it("rejects unsupported MIME types, path traversal, and oversized files", () => {
    expect(() => validateFileInput({ filename: "script.js", mimeType: "application/javascript", sizeBytes: 10, maxUploadSizeBytes: 1000, allowedMimeTypes: ["image/jpeg"] })).toThrow();
    expect(() => validateFileInput({ filename: "../photo.jpg", mimeType: "image/jpeg", sizeBytes: 10, maxUploadSizeBytes: 1000, allowedMimeTypes: ["image/jpeg"] })).toThrow();
    expect(() => validateFileInput({ filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 2000, maxUploadSizeBytes: 1000, allowedMimeTypes: ["image/jpeg"] })).toThrow();
  });

  it("accepts empty optional upload metadata from browser forms", () => {
    const parsed = storageUploadSchema.parse({
      module: "home_chefs",
      purpose: "order_attachment",
      visibility: "private",
      entityType: "home_chef_request",
      entityId: null,
      altText: null,
      caption: null,
    });

    expect(parsed.entityId).toBe("");
    expect(parsed.altText).toBe("");
    expect(parsed.caption).toBe("");
  });

  it("enforces tenant access for private files", () => {
    const file = { organizationId: "org-1", uploadedById: "user-1", visibility: "private", status: "active", countryCode: "US" } as never;
    expect(canAccessStorageFile({ ...adminSession(null), user: { id: "user-1", status: UserStatus.active, platformRole: null } }, file)).toBe(true);
    expect(canAccessStorageFile({ ...adminSession(null), user: { id: "user-2", status: UserStatus.active, platformRole: null }, activeOrganization: { id: "org-2", countryCode: "US", organizationType: "household" } }, file)).toBe(false);
    expect(canAccessStorageFile(adminSession("platform_admin"), file)).toBe(true);
  });

  it("builds a storage maintenance report for orphaned records, private docs, and usage", async () => {
    mockPrisma.storageFile.findMany.mockResolvedValue([
      {
        id: "file-1",
        organizationId: null,
        uploadedById: "admin-1",
        countryCode: "US",
        module: "menus",
        purpose: "menu_item_photo",
        status: "active",
        visibility: "public",
        mimeType: "image/jpeg",
        sizeBytes: 1000,
        objectKey: "nizamkitchen/test/system/file-1.jpg",
        originalFilename: "dish.jpg",
      },
      {
        id: "file-2",
        organizationId: "org-1",
        uploadedById: "seller-1",
        countryCode: "US",
        module: "home_chefs",
        purpose: "verification_document",
        status: "active",
        visibility: "private",
        mimeType: "application/pdf",
        sizeBytes: 2000,
        objectKey: "nizamkitchen/test/org-1/file-2.pdf",
        originalFilename: "license.pdf",
      },
      {
        id: "file-3",
        organizationId: "org-1",
        uploadedById: "seller-1",
        countryCode: "US",
        module: "support",
        purpose: "support_attachment",
        status: "deleted",
        visibility: "private",
        mimeType: "image/png",
        sizeBytes: 3000,
        objectKey: "nizamkitchen/test/org-1/file-3.png",
        originalFilename: "bug.png",
      },
    ]);

    const report = await getStorageMaintenanceReport(adminSession("platform_admin"));

    expect(report.totalFiles).toBe(3);
    expect(report.orphanedMetadataCandidates).toHaveLength(1);
    expect(report.privateDocuments).toHaveLength(1);
    expect(report.usageByOrganization.find((item) => item.organizationId === "org-1")?.totalBytes).toBe(5000);
    expect(report.unreferencedS3ObjectsStatus).toContain("placeholder");
  });

  it("archives deleted file metadata through an admin-only utility", async () => {
    mockPrisma.storageFile.updateMany.mockResolvedValue({ count: 2 });
    const result = await archiveDeletedStorageFiles(adminSession("platform_admin"));
    expect(result.count).toBe(2);
    expect(mockPrisma.storageFile.updateMany).toHaveBeenCalledWith({
      where: { status: "deleted" },
      data: { status: "archived" },
    });
    await expect(archiveDeletedStorageFiles(adminSession("support_admin"))).rejects.toThrow();
  });

  it("exposes admin bucket test routes and storage maintenance UI without secrets", () => {
    const testsPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/storage/tests/page.tsx"), "utf8");
    const maintenancePage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/storage/maintenance/page.tsx"), "utf8");
    const testRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/storage/test-connection/route.ts"), "utf8");
    const healthRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/health/storage/route.ts"), "utf8");
    expect(testsPage).toContain("test-${kind}");
    expect(testRoute).toContain("runStorageTest");
    expect(healthRoute).toContain("getStorageProvider");
    expect(healthRoute).not.toContain("OBJECT_STORAGE_ENDPOINT");
    expect(maintenancePage).toContain("Storage maintenance");
    expect(maintenancePage).not.toContain("secretAccessKey");
  });
});
