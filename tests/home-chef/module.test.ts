import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent, isFeatureEnabled } = vi.hoisted(() => {
  const requestUpdate = vi.fn();
  const historyCreate = vi.fn();
  return {
    mockPrisma: {
    recipe: {
      findFirst: vi.fn(),
    },
    mealPlan: {
      findFirst: vi.fn(),
    },
    homeChefRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: requestUpdate,
    },
    homeChefRequestMessage: {
      create: vi.fn(),
    },
    homeChefRequestStatusHistory: {
      create: historyCreate,
    },
    organization: {
      findFirst: vi.fn(),
    },
    sellerVerificationPolicy: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerPayoutAccount: { findFirst: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn() },
    $transaction: vi.fn((callback) =>
      callback({
        homeChefRequest: { update: requestUpdate },
        homeChefRequestStatusHistory: { create: historyCreate },
      }),
    ),
  },
    createAuditEvent: vi.fn(),
    isFeatureEnabled: vi.fn(),
    requestUpdate,
    historyCreate,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled }));

import {
  assignHomeChefRequest,
  canAccessHomeChefs,
  createHomeChefRequest,
  createHomeChefRequestMessage,
  getHomeChefRequest,
  listAdminHomeChefRequests,
  listAssignedChefRequests,
  updateAdminHomeChefRequestStatus,
} from "../../src/server/home-chef";
import { homeChefRequestCreateSchema } from "../../src/lib/validation/home-chef";

const adminSession = {
  user: { id: "admin-1", email: "platform-admin@example.test", status: "active" as const, platformRole: "platform_admin" as const },
  countryAssignments: [],
};

const countryManagerSession = {
  user: { id: "country-1", email: "country-manager@example.test", status: "active" as const, platformRole: "country_manager" as const },
  countryAssignments: [{ countryCode: "US" }],
};

describe("home chef request system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
  });

  it("creates an organization-scoped household request with status history and audit logs", async () => {
    mockPrisma.recipe.findFirst.mockResolvedValue({ id: "recipe-1", name: "Hyderabadi Chicken Biryani" });
    mockPrisma.mealPlan.findFirst.mockResolvedValue(null);
    mockPrisma.homeChefRequest.create.mockResolvedValue({
      id: "request-1",
      requestType: "recipe",
      status: "submitted",
      title: "Chef for biryani",
    });

    await createHomeChefRequest({
      organizationId: "org-1",
      countryCode: "US",
      createdById: "user-1",
      defaultCurrencyCode: "USD",
      input: {
        requestType: "recipe",
        recipeId: "recipe-1",
        title: "Chef for biryani",
        requestedDate: "2026-05-23",
        guestCount: 6,
        submit: true,
      },
    });

    expect(mockPrisma.recipe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "recipe-1",
          OR: expect.arrayContaining([expect.objectContaining({ organizationId: "org-1" })]),
        }),
      }),
    );
    expect(mockPrisma.homeChefRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          countryCode: "US",
          status: "submitted",
          statusHistory: expect.objectContaining({
            create: expect.objectContaining({ newStatus: "submitted" }),
          }),
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "home_chef_request.created" }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "home_chef_request.submitted" }));
  });

  it("scopes household detail reads to the active organization", async () => {
    mockPrisma.homeChefRequest.findFirst.mockResolvedValue(null);

    await expect(getHomeChefRequest("request-2", "org-a")).rejects.toThrow("Home chef request not found.");

    expect(mockPrisma.homeChefRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "request-2", organizationId: "org-a" } }),
    );
  });

  it("blocks invalid recipe request input without recipeId", () => {
    expect(() =>
      homeChefRequestCreateSchema.parse({
        requestType: "recipe",
        title: "Chef request",
        requestedDate: "2026-05-23",
        guestCount: 4,
      }),
    ).toThrow();
  });

  it("lets platform admins list all requests", async () => {
    mockPrisma.homeChefRequest.findMany.mockResolvedValue([{ id: "request-1" }]);

    await listAdminHomeChefRequests(adminSession, {});

    expect(mockPrisma.homeChefRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ countryCode: undefined }) }),
    );
  });

  it("limits country managers to assigned countries", async () => {
    await expect(
      listAdminHomeChefRequests(countryManagerSession, { countryCode: "IN" }),
    ).rejects.toThrow("Country is not assigned");

    expect(mockPrisma.homeChefRequest.findMany).not.toHaveBeenCalled();
  });

  it("lists chef-visible requests only by assigned chef organization", async () => {
    mockPrisma.homeChefRequest.findMany.mockResolvedValue([{ id: "request-1" }]);

    await listAssignedChefRequests("chef-org-1");

    expect(mockPrisma.homeChefRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assignedChefOrganizationId: "chef-org-1" } }),
    );
  });

  it("status changes create history and audit logs", async () => {
    mockPrisma.homeChefRequest.findUnique.mockResolvedValue({
      id: "request-1",
      organizationId: "org-1",
      countryCode: "US",
      status: "submitted",
    });
    mockPrisma.homeChefRequest.update.mockResolvedValue({ id: "request-1", status: "reviewing" });
    mockPrisma.homeChefRequestStatusHistory.create.mockResolvedValue({ id: "history-1" });

    await updateAdminHomeChefRequestStatus({
      session: adminSession,
      requestId: "request-1",
      input: { status: "reviewing", note: "Reviewing details." },
    });

    expect(mockPrisma.homeChefRequestStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ oldStatus: "submitted", newStatus: "reviewing" }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "home_chef_request.status_changed" }));
  });

  it("assigns only chef organizations in the request country", async () => {
    mockPrisma.homeChefRequest.findUnique.mockResolvedValue({
      id: "request-1",
      organizationId: "org-1",
      countryCode: "US",
      status: "submitted",
    });
    mockPrisma.organization.findFirst.mockResolvedValue({ id: "chef-org-1", name: "Chef Org" });
    mockPrisma.homeChefRequest.update.mockResolvedValue({ id: "request-1", assignedChefOrganizationId: "chef-org-1" });

    await assignHomeChefRequest({
      session: adminSession,
      requestId: "request-1",
      input: { assignedChefOrganizationId: "chef-org-1" },
    });

    expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "chef-org-1",
          organizationType: "chef_business",
          countryCode: "US",
        }),
      }),
    );
    expect(mockPrisma.homeChefRequestStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ oldStatus: "submitted", newStatus: "matched" }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "home_chef_request.assigned" }));
  });

  it("blocks home chef assignment when required chef verification is missing", async () => {
    mockPrisma.homeChefRequest.findUnique.mockResolvedValue({
      id: "request-1",
      organizationId: "org-1",
      countryCode: "US",
      status: "submitted",
    });
    mockPrisma.organization.findFirst.mockResolvedValue({ id: "chef-org-1", name: "Chef Org" });
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([{
      id: "policy-1",
      policyName: "Chef verification gate",
      countryCode: "US",
      region: null,
      sellerType: "chef_business",
      status: "active",
      allowOrderAcceptanceBeforeVerification: false,
      allowPublicProfileBeforeVerification: true,
      allowMenuPublishingBeforeVerification: true,
      allowPayoutsBeforeVerification: true,
      requireAdminApproval: true,
      requireIdentityVerification: false,
      requireFoodHandlerCertificate: true,
      requireLocalPermit: false,
      requireKitchenReview: false,
      requireBackgroundCheck: true,
      requirePayoutOnboarding: false,
      updatedAt: new Date(),
    }]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue({ status: "submitted", items: [], foodSafetyCertificates: [], permits: [], kitchenReviews: [], backgroundChecks: [], identityVerifications: [] });

    await expect(assignHomeChefRequest({
      session: adminSession,
      requestId: "request-1",
      input: { assignedChefOrganizationId: "chef-org-1" },
    })).rejects.toThrow("Chef verification is incomplete");
  });

  it("creates household messages without allowing internal notes", async () => {
    mockPrisma.homeChefRequest.findFirst.mockResolvedValue({
      id: "request-1",
      organizationId: "org-1",
      countryCode: "US",
      status: "submitted",
    });
    mockPrisma.homeChefRequestMessage.create.mockResolvedValue({ id: "message-1" });

    await createHomeChefRequestMessage({
      requestId: "request-1",
      organizationId: "org-1",
      actorUserId: "user-1",
      senderRole: "household",
      input: { message: "Can support review this?", isInternal: false },
    });

    await expect(
      createHomeChefRequestMessage({
        requestId: "request-1",
        organizationId: "org-1",
        actorUserId: "user-1",
        senderRole: "household",
        input: { message: "secret", isInternal: true },
      }),
    ).rejects.toThrow("Household messages cannot be internal");
  });

  it("uses the home_chefs feature flag for regular organizations and lets admins bypass", async () => {
    isFeatureEnabled.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(canAccessHomeChefs({ organizationId: "org-1", platformRole: null })).resolves.toBe(false);
    await expect(canAccessHomeChefs({ organizationId: "org-1", platformRole: null })).resolves.toBe(true);
    await expect(canAccessHomeChefs({ organizationId: "org-1", platformRole: "platform_admin" })).resolves.toBe(true);
  });
});
