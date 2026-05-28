import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus, type PlatformRole } from "@prisma/client";

const { mockPrisma, mockCreateAuditEvent } = vi.hoisted(() => ({
  mockPrisma: {
    storageConfiguration: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    storageFile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    storageFileAccessLog: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  mockCreateAuditEvent: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "dropbox-test-encryption-key-that-is-long-enough",
    NODE_ENV: "test",
    DEPLOYMENT_ENVIRONMENT: "test",
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: mockCreateAuditEvent }));
vi.mock("@/server/storage/signed-urls", () => ({
  createSignedReadUrl: vi.fn(async () => ({
    url: "https://signed.example.com/read-url",
    expiresInSeconds: 900,
    ipAddress: null,
    userAgent: null,
  })),
}));

import { assertDropboxAccess, canAccessAdminDropboxFile, canAccessStorageFile } from "@/server/storage/storage-permissions";
import {
  archiveStorageFile,
  getAdminDropboxSignedUrl,
  getDropboxFile,
  listStorageFiles,
  restoreStorageFile,
} from "@/server/storage/storage-service";

function session(role: PlatformRole | null = "platform_owner", countryAssignments = [{ countryCode: "US" }]) {
  return {
    user: { id: "user-1", status: UserStatus.active, platformRole: role },
    activeOrganization: { id: "org-1", countryCode: "US", organizationType: "household" },
    activeMembership: { role: "org_owner", status: "active" },
    countryAssignments,
  };
}

const file = {
  id: "file-1",
  organizationId: "org-1",
  userId: null,
  uploadedById: "uploader-1",
  countryCode: "US",
  module: "menus",
  entityType: "menu_item",
  entityId: "menu-item-1",
  provider: "aws_s3",
  bucketName: "nizam-prod",
  objectKey: "nizamkitchen/test/US/org-1/menus/menu_item/menu-item-1/menu_item_photo/file-1-photo.jpg",
  originalFilename: "photo.jpg",
  storedFilename: "file-1-photo.jpg",
  mimeType: "image/jpeg",
  fileExtension: "jpg",
  sizeBytes: 1024,
  checksumSha256: "abc123",
  visibility: "private",
  status: "active",
  purpose: "menu_item_photo",
  metadataJson: null,
  imageWidth: null,
  imageHeight: null,
  altText: null,
  caption: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("admin Dropbox file manager", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.storageFile.findMany.mockResolvedValue([]);
    mockPrisma.storageFile.findUnique.mockResolvedValue(file);
    mockPrisma.storageFile.update.mockImplementation(async ({ data }) => ({ ...file, ...data }));
  });

  it("allows platform owner/admin/support/country manager and blocks household users", () => {
    expect(() => assertDropboxAccess(session("platform_owner"))).not.toThrow();
    expect(() => assertDropboxAccess(session("platform_admin"))).not.toThrow();
    expect(() => assertDropboxAccess(session("support_admin"))).not.toThrow();
    expect(() => assertDropboxAccess(session("country_manager"))).not.toThrow();
    expect(() => assertDropboxAccess(session(null))).toThrow();
  });

  it("scopes country managers to assigned-country files", async () => {
    await listStorageFiles(session("country_manager", [{ countryCode: "CA" }, { countryCode: "US" }]));

    expect(mockPrisma.storageFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ countryCode: { in: ["CA", "US"] } }),
      }),
    );
  });

  it("keeps country managers scoped even when filtering for an unassigned country", async () => {
    await listStorageFiles(session("country_manager", [{ countryCode: "US" }]), { countryCode: "IN" });

    expect(mockPrisma.storageFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ countryCode: { in: ["US"] } }),
      }),
    );
  });

  it("applies admin file listing filters", async () => {
    await listStorageFiles(session("platform_admin"), {
      search: "biryani",
      module: "menus",
      purpose: "menu_item_photo",
      status: "active",
      visibility: "private",
      mimeType: "image/",
      organizationId: "org-1",
      userId: "uploader-1",
      countryCode: "US",
      minSize: 100,
      maxSize: 5000,
    });

    expect(mockPrisma.storageFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: "menus",
          organizationId: "org-1",
          countryCode: "US",
          purpose: "menu_item_photo",
          status: "active",
          visibility: "private",
          originalFilename: { contains: "biryani", mode: "insensitive" },
          mimeType: { contains: "image/", mode: "insensitive" },
          sizeBytes: { gte: 100, lte: 5000 },
        }),
      }),
    );
  });

  it("requires file permissions before creating signed preview/download URLs", async () => {
    mockPrisma.storageFile.findUnique.mockResolvedValueOnce({ ...file, countryCode: "IN" });

    await expect(getAdminDropboxSignedUrl(session("country_manager", [{ countryCode: "US" }]), "file-1", "preview")).rejects.toThrow("File not found.");
  });

  it("does not let country managers use public visibility to bypass Dropbox country scope", () => {
    expect(canAccessAdminDropboxFile(session("country_manager", [{ countryCode: "US" }]), { ...file, countryCode: "IN", visibility: "public" } as never)).toBe(false);
  });

  it("creates signed URLs and admin Dropbox audit logs for allowed users", async () => {
    const url = await getAdminDropboxSignedUrl(session("platform_admin"), "file-1", "download");

    expect(url.url).toBe("https://signed.example.com/read-url");
    expect(mockPrisma.storageFileAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fileId: "file-1", action: "signed_url_created" }) }),
    );
    expect(mockCreateAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin_dropbox.file_downloaded", targetId: "file-1" }),
    );
  });

  it("archives and restores files with access logs and audit events", async () => {
    await archiveStorageFile(session("platform_owner"), "file-1");
    await restoreStorageFile(session("platform_owner"), "file-1");

    expect(mockPrisma.storageFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "file-1" }, data: { status: "archived" } }),
    );
    expect(mockPrisma.storageFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "file-1" }, data: { status: "active", deletedAt: null } }),
    );
    expect(mockCreateAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "admin_dropbox.file_archived" }));
    expect(mockCreateAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "admin_dropbox.file_restored" }));
  });

  it("records detail views but does not include S3 secrets in the detail page source", async () => {
    mockPrisma.storageFile.findUnique.mockResolvedValueOnce({ ...file, accessLogs: [], versions: [] });
    await getDropboxFile(session("support_admin"), "file-1");

    expect(mockCreateAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "admin_dropbox.viewed" }));

    const source = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/dropbox/files/[id]/page.tsx"), "utf8");
    expect(source).not.toContain("encryptedAccessKeyId");
    expect(source).not.toContain("encryptedSecretAccessKey");
    expect(source).not.toContain(["AWS", "SECRET", "ACCESS", "KEY"].join("_"));
    expect(source).toContain("Preview unsupported");
  });

  it("blocks deleted files from normal signed URL access", () => {
    expect(canAccessStorageFile(session("platform_admin"), { ...file, status: "deleted" } as never)).toBe(false);
  });
});
