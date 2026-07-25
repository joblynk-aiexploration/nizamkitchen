import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repoRoot = process.cwd();

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
    homeChefRequestOffer: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    homeChefAcceptancePolicy: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chefProfile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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
        homeChefRequestOffer: {
          create: mockPrisma.homeChefRequestOffer.create,
          update: mockPrisma.homeChefRequestOffer.update,
          updateMany: mockPrisma.homeChefRequestOffer.updateMany,
        },
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
  createChefHomeChefOrderMessage,
  createHomeChefRequestOffer,
  createHomeChefRequest,
  createHomeChefRequestMessage,
  getChefHomeChefRequest,
  getHomeChefRequest,
  listAdminHomeChefRequests,
  listAssignedChefRequests,
  listChefRequestInbox,
  updateChefHomeChefOrderStatus,
  updateAdminHomeChefRequestStatus,
} from "../../src/server/home-chef";
import { homeChefRequestCreateSchema } from "../../src/lib/validation/home-chef";
import { CUSTOM_HOME_CHEF_FOOD_VALUE, homeChefRequestInputFromForm } from "../../src/lib/home-chef-request-form";

function futureIsoDate(daysFromNow = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

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
    mockPrisma.homeChefRequestOffer.findFirst.mockResolvedValue(null);
    mockPrisma.homeChefAcceptancePolicy.findMany.mockResolvedValue([]);
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
        requestedDate: futureIsoDate(),
        guestCount: 6,
        serviceAddressLine1: "123 Main Street",
        city: "Frisco",
        region: "TX",
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

  it("builds recipe-based food requests from the household food dropdown", () => {
    const formData = new FormData();
    formData.set("foodChoice", "recipe-1");
    formData.set("selectedFoodName", "Chicken Dum Biryani");
    formData.set("requestedDate", "2026-05-23");
    formData.set("guestCount", "4");
    formData.set("intent", "submit");

    const input = homeChefRequestInputFromForm(formData);

    expect(input).toEqual(expect.objectContaining({
      requestType: "recipe",
      recipeId: "recipe-1",
      title: "Chef for Chicken Dum Biryani",
      submit: true,
    }));
  });

  it("builds custom food requests when the food is not listed", () => {
    const formData = new FormData();
    formData.set("foodChoice", CUSTOM_HOME_CHEF_FOOD_VALUE);
    formData.set("customFoodTitle", "Chicken 65");
    formData.set("customFoodDescription", "Crispy spicy appetizer for a birthday dinner.");
    formData.set("description", "Please keep one portion mild.");
    formData.set("requestedDate", "2026-05-23");
    formData.set("guestCount", "4");

    const input = homeChefRequestInputFromForm(formData);

    expect(input).toEqual(expect.objectContaining({
      requestType: "custom",
      recipeId: null,
      title: "Chicken 65",
      description: "Requested food: Chicken 65\n\nFood details: Crispy spicy appetizer for a birthday dinner.\n\nPlease keep one portion mild.",
    }));
  });

  it("uses structured date and time controls on household chef request pages", () => {
    const scheduleSource = fs.readFileSync(`${repoRoot}/src/components/home-chef/request-schedule-fields.tsx`, "utf8");
    const generalRequestPage = fs.readFileSync(`${repoRoot}/src/app/(app)/home-chef/request/page.tsx`, "utf8");
    const chefRequestPage = fs.readFileSync(`${repoRoot}/src/app/(app)/chefs/[slug]/request/page.tsx`, "utf8");

    expect(scheduleSource).toContain('name="requestedDate"');
    expect(scheduleSource).toContain('name="requestedTimeWindow"');
    expect(scheduleSource).toContain('type="time"');
    expect(scheduleSource).toContain("Save date");
    expect(generalRequestPage).toContain("<RequestScheduleFields");
    expect(chefRequestPage).toContain("<RequestScheduleFields");
    expect(generalRequestPage).not.toContain('label="Time window"');
    expect(chefRequestPage).not.toContain('label="Time window"');
  });

  it("routes recipe details through a chef or caterer chooser with verified provider cards", () => {
    const recipePage = fs.readFileSync(`${repoRoot}/src/app/(app)/recipes/[id]/page.tsx`, "utf8");
    const chooserPage = fs.readFileSync(`${repoRoot}/src/app/(app)/recipes/[id]/request/page.tsx`, "utf8");
    const chefRequestPage = fs.readFileSync(`${repoRoot}/src/app/(app)/chefs/[slug]/request/page.tsx`, "utf8");

    expect(recipePage).toContain("Request chef/caterer");
    expect(recipePage).toContain("/request");
    expect(chooserPage).toContain("Who should cook");
    expect(chooserPage).toContain("verifiedOnly: true");
    expect(chooserPage).toContain("Verified home chefs");
    expect(chooserPage).toContain("Verified caterers");
    expect(chooserPage).toContain("Restaurant caterer");
    expect(chooserPage).toContain("Home caterer");
    expect(chooserPage).toContain("organization.name");
    expect(chooserPage).toContain("Place order");
    expect(chefRequestPage).toContain("recipeId?: string");
    expect(chefRequestPage).toContain("defaultRecipeId={selectedRecipe?.id}");
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
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ assignedChefOrganizationId: "chef-org-1" }),
            expect.objectContaining({ offers: expect.any(Object) }),
          ]),
        }),
      }),
    );
  });

  it("keeps the chef inbox scoped to assigned requests only", async () => {
    mockPrisma.homeChefRequest.findMany.mockResolvedValue([{ id: "request-1" }]);

    await listChefRequestInbox({ organizationId: "chef-org-1", countryCode: "US" });

    expect(mockPrisma.homeChefRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          countryCode: "US",
          OR: expect.arrayContaining([
            expect.objectContaining({ assignedChefOrganizationId: "chef-org-1" }),
            expect.objectContaining({ offers: expect.any(Object) }),
          ]),
        }),
      }),
    );
  });

  it("loads chef order details only when assigned to that chef organization", async () => {
    mockPrisma.homeChefRequest.findFirst.mockResolvedValue({ id: "request-1" });

    await getChefHomeChefRequest({
      requestId: "request-1",
      chefOrganizationId: "chef-org-1",
      countryCode: "US",
    });

    expect(mockPrisma.homeChefRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "request-1",
          OR: expect.arrayContaining([
            expect.objectContaining({ assignedChefOrganizationId: "chef-org-1" }),
            expect.objectContaining({ offers: expect.any(Object) }),
          ]),
          countryCode: "US",
        },
      }),
    );
  });

  it("lets an assigned chef accept an order", async () => {
    mockPrisma.homeChefRequest.findFirst.mockResolvedValue({
      id: "request-1",
      status: "matched",
      title: "Family dinner",
      organizationId: "household-org",
      countryCode: "US",
      createdById: "household-user",
    });
    mockPrisma.homeChefRequest.update.mockResolvedValue({ id: "request-1", status: "accepted" });

    await updateChefHomeChefOrderStatus({
      requestId: "request-1",
      chefOrganizationId: "chef-org-1",
      countryCode: "US",
      actorUserId: "chef-user",
      status: "accepted",
    });

    expect(mockPrisma.homeChefRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "request-1" }, data: { status: "accepted" } }),
    );
    expect(mockPrisma.homeChefRequestStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: "matched",
          newStatus: "accepted",
          changedById: "chef-user",
        }),
      }),
    );
  });

  it("attaches the chef profile when accepting a legacy organization-assigned order", async () => {
    mockPrisma.homeChefRequest.findFirst.mockResolvedValue({
      id: "request-legacy",
      status: "reviewing",
      title: "Family dinner",
      organizationId: "household-org",
      countryCode: "US",
      createdById: "household-user",
      assignedChefOrganizationId: "chef-org-1",
      assignedChefProfileId: null,
    });
    mockPrisma.chefProfile.findUnique.mockResolvedValue({ id: "chef-profile-1" });
    mockPrisma.homeChefRequest.update.mockResolvedValue({
      id: "request-legacy",
      status: "accepted",
      assignedChefProfileId: "chef-profile-1",
    });

    await updateChefHomeChefOrderStatus({
      requestId: "request-legacy",
      chefOrganizationId: "chef-org-1",
      countryCode: "US",
      actorUserId: "chef-user",
      status: "accepted",
    });

    expect(mockPrisma.chefProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "chef-org-1" },
        select: { id: true },
      }),
    );
    expect(mockPrisma.homeChefRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "request-legacy" },
        data: expect.objectContaining({
          status: "accepted",
          assignedChefProfileId: "chef-profile-1",
          matchingStatus: "chef_accepted",
        }),
      }),
    );
  });

  it("creates a deadline-bound offer for an active verified chef profile", async () => {
    mockPrisma.homeChefRequest.findUnique.mockResolvedValue({
      id: "request-1",
      status: "submitted",
      title: "Family dinner",
      organizationId: "household-org",
      countryCode: "US",
      city: "Chicago",
      region: "IL",
      createdById: "household-user",
      requestType: "recipe",
      leadTimeCategory: "short_term",
      currencyCode: "USD",
    });
    mockPrisma.chefProfile.findFirst.mockResolvedValue({
      id: "chef-profile-1",
      organizationId: "chef-org-1",
      displayName: "Nizam Independent Home Chef",
      verificationStatus: "verified",
    });
    mockPrisma.homeChefRequestOffer.create.mockResolvedValue({
      id: "offer-1",
      status: "pending",
      chefProfileId: "chef-profile-1",
    });

    await createHomeChefRequestOffer({
      session: adminSession,
      requestId: "request-1",
      input: { chefProfileId: "chef-profile-1", responseWindowMinutes: 180 },
    });

    expect(mockPrisma.homeChefRequestOffer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ homeChefRequestId: "request-1", status: "pending" }),
        data: expect.objectContaining({ status: "cancelled" }),
      }),
    );
    expect(mockPrisma.homeChefRequestOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          homeChefRequestId: "request-1",
          chefProfileId: "chef-profile-1",
          status: "pending",
          responseDeadlineAt: expect.any(Date),
        }),
      }),
    );
    expect(mockPrisma.homeChefRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedChefProfileId: "chef-profile-1",
          matchingStatus: "offered",
        }),
      }),
    );
  });

  it("lets an assigned chef send a household-visible order message", async () => {
    mockPrisma.homeChefRequest.findFirst.mockResolvedValue({
      id: "request-1",
      title: "Family dinner",
      organizationId: "household-org",
      countryCode: "US",
      createdById: "household-user",
    });
    mockPrisma.homeChefRequestMessage.create.mockResolvedValue({ id: "message-1" });

    await createChefHomeChefOrderMessage({
      requestId: "request-1",
      chefOrganizationId: "chef-org-1",
      countryCode: "US",
      actorUserId: "chef-user",
      input: { message: "I can cook this for you." },
    });

    expect(mockPrisma.homeChefRequestMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: "request-1",
          senderUserId: "chef-user",
          senderRole: "chef",
          isInternal: false,
        }),
      }),
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
