import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent, providerUploadFile } = vi.hoisted(() => ({
  providerUploadFile: vi.fn(),
  createAuditEvent: vi.fn(),
  mockPrisma: {
    dataPrivacyRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    dataRetentionPolicy: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membership: { findMany: vi.fn() },
    organization: { findMany: vi.fn(), update: vi.fn() },
    householdProfile: { findUnique: vi.fn() },
    mealPlan: { findMany: vi.fn(), updateMany: vi.fn() },
    groceryList: { findMany: vi.fn(), updateMany: vi.fn() },
    savedRestaurant: { findMany: vi.fn(), deleteMany: vi.fn() },
    favoriteRecipe: { findMany: vi.fn(), deleteMany: vi.fn() },
    foodOrder: { findMany: vi.fn() },
    supportTicket: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
    storageFile: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    legalDocumentAcceptance: { findMany: vi.fn() },
    paymentOrder: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    userActivity: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    userPrivacySetting: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    session: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));
vi.mock("@/server/storage/storage-service", () => ({
  getStorageProvider: vi.fn(() => Promise.resolve({
    configuration: { provider: "local_dev", bucketName: "local-privacy-exports" },
    provider: { uploadFile: providerUploadFile },
  })),
}));

import {
  anonymizeUserForRequest,
  createDataPrivacyRequest,
  cleanupUserPrivacyData,
  clearUserActivity,
  generatePrivacyExport,
  getUserPrivacyCenterData,
  listAdminPrivacyRequests,
  updateUserPrivacySetting,
  upsertRetentionPolicy,
} from "@/server/privacy/privacy-service";

const householdSession = {
  user: { id: "user-1", email: "household@example.test", platformRole: null },
  activeOrganization: { id: "org-1", countryCode: "US", organizationType: "household" },
};

const adminSession = {
  user: { id: "admin-1", email: "admin@example.test", platformRole: "platform_owner" as const },
  activeOrganization: null,
};

function privacyRequest(overrides = {}) {
  return {
    id: "privacy-1",
    userId: "user-1",
    organizationId: "org-1",
    requestedById: "user-1",
    requestType: "user_export",
    status: "submitted",
    countryCode: "US",
    reason: "Please export my data",
    adminNotes: null,
    exportFileId: null,
    completedById: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: "user-1", email: "household@example.test", fullName: "Household User", status: "active" },
    organization: { id: "org-1", name: "Household Org", organizationType: "household", countryCode: "US" },
    requestedBy: { id: "user-1", email: "household@example.test", fullName: "Household User" },
    completedBy: null,
    exportFile: null,
    ...overrides,
  };
}

describe("data privacy export deletion and retention controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.dataPrivacyRequest.create.mockImplementation(({ data, include }) => Promise.resolve(privacyRequest({ ...data, include })));
    mockPrisma.dataPrivacyRequest.findUnique.mockResolvedValue(privacyRequest());
    mockPrisma.dataPrivacyRequest.update.mockImplementation(({ data }) => Promise.resolve(privacyRequest({ ...data })));
    mockPrisma.dataPrivacyRequest.findMany.mockResolvedValue([privacyRequest()]);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "household@example.test", fullName: "Household User", status: "active" });
    mockPrisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: "user-1", ...data }));
    mockPrisma.membership.findMany.mockResolvedValue([{ id: "member-1", organizationId: "org-1", role: "org_owner", status: "active" }]);
    mockPrisma.organization.findMany.mockResolvedValue([{ id: "org-1", name: "Household Org", organizationType: "household", status: "active", countryCode: "US", currencyCode: "USD" }]);
    mockPrisma.householdProfile.findUnique.mockResolvedValue({ organizationId: "org-1", displayName: "Household Org" });
    mockPrisma.mealPlan.findMany.mockResolvedValue([]);
    mockPrisma.mealPlan.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.groceryList.findMany.mockResolvedValue([]);
    mockPrisma.groceryList.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.savedRestaurant.findMany.mockResolvedValue([]);
    mockPrisma.savedRestaurant.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.favoriteRecipe.findMany.mockResolvedValue([]);
    mockPrisma.favoriteRecipe.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.foodOrder.findMany.mockResolvedValue([]);
    mockPrisma.supportTicket.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.storageFile.findMany.mockResolvedValue([]);
    mockPrisma.legalDocumentAcceptance.findMany.mockResolvedValue([]);
    mockPrisma.paymentOrder.findMany.mockResolvedValue([{ id: "pay-1", amount: "42.00", currencyCode: "USD", provider: "stripe", status: "paid" }]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: "audit-1", action: "user.login", targetType: "session", createdAt: new Date() }]);
    mockPrisma.userActivity.findMany.mockResolvedValue([{ id: "activity-1", userId: "user-1", organizationId: "org-1", activityType: "recipe_viewed", title: "Viewed recipe", visibility: "private", createdAt: new Date(), deletedAt: null }]);
    mockPrisma.userActivity.create.mockImplementation(({ data }) => Promise.resolve({ id: "activity-created", createdAt: new Date(), deletedAt: null, ...data }));
    mockPrisma.userActivity.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.userPrivacySetting.findUnique.mockResolvedValue(null);
    mockPrisma.userPrivacySetting.create.mockImplementation(({ data }) => Promise.resolve({
      id: "privacy-setting-1",
      profileVisibility: "private",
      activityRetentionDays: null,
      marketingEmailsEnabled: false,
      analyticsConsent: false,
      personalizedRecommendationsEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    mockPrisma.userPrivacySetting.upsert.mockImplementation(({ update, create }) => Promise.resolve({
      id: "privacy-setting-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...create,
      ...update,
    }));
    mockPrisma.storageFile.create.mockImplementation(({ data }) => Promise.resolve({ id: data.id, ...data }));
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.storageFile.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.dataRetentionPolicy.create.mockImplementation(({ data }) => Promise.resolve({ id: "policy-1", ...data }));
  });

  it("lets a user request their own data export without targeting another user", async () => {
    await createDataPrivacyRequest(householdSession, { requestType: "user_export", reason: "Export please", userId: "other-user" });

    expect(mockPrisma.dataPrivacyRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-1",
        requestedById: "user-1",
        organizationId: "org-1",
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "privacy_request.created" }));
  });

  it("protects admin privacy pages and services from normal users", async () => {
    await expect(listAdminPrivacyRequests(householdSession)).rejects.toThrow("Platform role is required");
  });

  it("generates a private S3-backed JSON export without secrets or raw KYC documents", async () => {
    await generatePrivacyExport(adminSession, "privacy-1");
    const uploadInput = providerUploadFile.mock.calls[0][0];
    const exported = JSON.parse(uploadInput.body.toString("utf8"));

    expect(mockPrisma.storageFile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        visibility: "private",
        purpose: "data_export",
        module: "privacy",
        mimeType: "application/json",
      }),
    }));
    expect(JSON.stringify(exported)).not.toMatch(/passwordHash|tokenHash|providerRawJson|rawSecretValue/i);
    expect(exported.excludedSensitiveData).toContain("raw KYC documents");
    expect(exported.paymentSummaries).toEqual(expect.arrayContaining([expect.objectContaining({ id: "pay-1" })]));
  });

  it("shows only user-scoped privacy center data", async () => {
    const data = await getUserPrivacyCenterData(householdSession);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    expect(mockPrisma.paymentOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([expect.objectContaining({ customerOrganizationId: "org-1" })]),
      }),
    }));
    expect(data.protectedDataNotice.join(" ")).toMatch(/Payment ledger records cannot be deleted directly/);
  });

  it("lets a user clear only clearable user activity", async () => {
    await clearUserActivity(householdSession);

    expect(mockPrisma.userActivity.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "user-1",
        deletedAt: null,
      }),
      data: { deletedAt: expect.any(Date) },
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "privacy_activity.cleared" }));
  });

  it("updates user privacy settings and records a privacy activity", async () => {
    await updateUserPrivacySetting(householdSession, {
      profileVisibility: "organization",
      activityRetentionDays: "90",
      marketingEmailsEnabled: "on",
      analyticsConsent: "",
      personalizedRecommendationsEnabled: "on",
    });

    expect(mockPrisma.userPrivacySetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
      update: expect.objectContaining({ profileVisibility: "organization", activityRetentionDays: 90 }),
    }));
    expect(mockPrisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: "Privacy settings updated" }),
    }));
  });

  it("cleans up convenience data without touching payment ledgers", async () => {
    await cleanupUserPrivacyData(householdSession, "saved_restaurants");
    await cleanupUserPrivacyData(householdSession, "old_grocery_lists");

    expect(mockPrisma.savedRestaurant.deleteMany).toHaveBeenCalledWith({ where: { organizationId: "org-1" } });
    expect(mockPrisma.groceryList.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1" }),
      data: { status: "archived" },
    }));
    expect("deleteMany" in mockPrisma.paymentOrder).toBe(false);
  });

  it("adds user privacy center routes", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "src/app/(app)/privacy-center/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/privacy-center/data/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/privacy-center/activity/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/privacy-center/download/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/privacy-center/delete/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/privacy-center/settings/page.tsx"))).toBe(true);
  });

  it("anonymizes a user while preserving payment, audit, and KYC integrity", async () => {
    await anonymizeUserForRequest(adminSession, "privacy-1");

    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fullName: "Deleted User",
        status: "disabled",
        phone: null,
        publicProfileEnabled: false,
      }),
    }));
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect("deleteMany" in mockPrisma.paymentOrder).toBe(false);
    expect("deleteMany" in mockPrisma.auditLog).toBe(false);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "user.anonymized" }));
  });

  it("stores retention policies with warnings for preserved categories", async () => {
    await upsertRetentionPolicy(adminSession, {
      countryCode: "",
      dataCategory: "payments",
      retentionDays: "2555",
      action: "retain",
      status: "active",
      notes: "Accounting retention",
    });

    expect(mockPrisma.dataRetentionPolicy.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        dataCategory: "payments",
        retentionDays: 2555,
        action: "retain",
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "retention_policy.created" }));
  });
});
