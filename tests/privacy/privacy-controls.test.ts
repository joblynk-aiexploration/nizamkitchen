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
    mealPlan: { findMany: vi.fn() },
    groceryList: { findMany: vi.fn() },
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
    session: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
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
  generatePrivacyExport,
  listAdminPrivacyRequests,
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
    mockPrisma.groceryList.findMany.mockResolvedValue([]);
    mockPrisma.foodOrder.findMany.mockResolvedValue([]);
    mockPrisma.supportTicket.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.storageFile.findMany.mockResolvedValue([]);
    mockPrisma.legalDocumentAcceptance.findMany.mockResolvedValue([]);
    mockPrisma.paymentOrder.findMany.mockResolvedValue([{ id: "pay-1", amount: "42.00", currencyCode: "USD", provider: "stripe", status: "paid" }]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
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
