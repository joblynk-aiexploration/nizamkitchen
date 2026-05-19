import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus, type PlatformRole } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    storageConfiguration: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    storageFile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
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

import { decryptGatewayCredential } from "@/server/payments/credentials";
import { validateFileInput } from "@/server/storage/file-validation";
import { buildStorageObjectKey } from "@/server/storage/storage-keys";
import { canAccessStorageFile } from "@/server/storage/storage-permissions";
import { listStorageConfigurations, saveStorageConfiguration } from "@/server/storage/storage-service";

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

  it("enforces tenant access for private files", () => {
    const file = { organizationId: "org-1", uploadedById: "user-1", visibility: "private", status: "active", countryCode: "US" } as never;
    expect(canAccessStorageFile({ ...adminSession(null), user: { id: "user-1", status: UserStatus.active, platformRole: null } }, file)).toBe(true);
    expect(canAccessStorageFile({ ...adminSession(null), user: { id: "user-2", status: UserStatus.active, platformRole: null }, activeOrganization: { id: "org-2", countryCode: "US", organizationType: "household" } }, file)).toBe(false);
    expect(canAccessStorageFile(adminSession("platform_admin"), file)).toBe(true);
  });
});
