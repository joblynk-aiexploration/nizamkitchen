import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent, isFeatureEnabled, createHomeChefRequest } = vi.hoisted(() => ({
  mockPrisma: {
    chefProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    chefService: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chefSpecialtyRecipe: {
      create: vi.fn(),
    },
    chefAvailability: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chefReview: {
      create: vi.fn(),
      update: vi.fn(),
    },
    homeChefRequest: {
      update: vi.fn(),
    },
    homeChefRequestOffer: {
      create: vi.fn(),
    },
    sellerVerificationPolicy: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerPayoutAccount: { findFirst: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn() },
  },
  createAuditEvent: vi.fn(),
  isFeatureEnabled: vi.fn(),
  createHomeChefRequest: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled }));
vi.mock("@/server/home-chef", () => ({
  createHomeChefRequest,
}));

import {
  canAccessChefMarketplace,
  getAdminChefProfile,
  listAdminChefProfiles,
  listPublicChefProfiles,
  requestSpecificChef,
  updateAdminChefProfileStatus,
  upsertChefProfile,
} from "../../src/server/chefs";

const adminSession = {
  user: { id: "admin-1", email: "admin@example.test", status: "active" as const, platformRole: "platform_admin" as const },
  countryAssignments: [],
};

const countryManagerSession = {
  user: { id: "country-1", email: "country@example.test", status: "active" as const, platformRole: "country_manager" as const },
  countryAssignments: [{ countryCode: "US" }],
};

describe("home chef marketplace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
  });

  it("lets a chef business create its own profile and logs audit", async () => {
    mockPrisma.chefProfile.findUnique.mockResolvedValue(null);
    mockPrisma.chefProfile.upsert.mockResolvedValue({ id: "chef-profile-1", displayName: "Hyderabad Home Kitchen", verificationStatus: "pending" });

    await upsertChefProfile({
      organizationId: "chef-org-1",
      countryCode: "US",
      actorUserId: "chef-user-1",
      input: {
        displayName: "Hyderabad Home Kitchen",
        bio: "Hyderabadi family cooking with biryani, dal, and weekly meal support.",
        languages: "English, Urdu",
        specialties: "Biryani, Khatti Dal",
        submitForVerification: true,
      },
    });

    expect(mockPrisma.chefProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "chef-org-1" },
        create: expect.objectContaining({
          organizationId: "chef-org-1",
          isPublic: false,
          verificationStatus: "pending",
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "chef_profile.created" }));
  });

  it("uses the home_chefs feature flag for household browsing", async () => {
    isFeatureEnabled.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(canAccessChefMarketplace({ organizationId: "household-1" })).resolves.toBe(false);
    await expect(canAccessChefMarketplace({ organizationId: "household-1" })).resolves.toBe(true);
    await expect(canAccessChefMarketplace({ organizationId: "household-1", platformRole: "platform_admin" })).resolves.toBe(true);
  });

  it("household browsing returns only public active chefs from query", async () => {
    isFeatureEnabled.mockResolvedValue(true);
    mockPrisma.chefProfile.findMany.mockResolvedValue([{ id: "chef-1", organizationId: "chef-org-1", countryCode: "US", baseRegion: null, status: "active", isPublic: true }]);

    await listPublicChefProfiles({ organizationId: "household-1", verifiedOnly: true, serviceType: "occasion" });

    expect(mockPrisma.chefProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
          isPublic: true,
          verificationStatus: "verified",
        }),
      }),
    );
  });

  it("platform admin can approve and verify chef profile", async () => {
    mockPrisma.chefProfile.findUnique.mockResolvedValue({
      id: "chef-profile-1",
      organizationId: "chef-org-1",
      countryCode: "US",
      status: "draft",
      verificationStatus: "pending",
    });
    mockPrisma.chefProfile.update.mockResolvedValue({
      id: "chef-profile-1",
      status: "active",
      verificationStatus: "verified",
      isPublic: true,
    });

    await updateAdminChefProfileStatus({
      session: adminSession,
      chefProfileId: "chef-profile-1",
      input: { status: "active", verificationStatus: "verified", isPublic: true },
    });

    expect(mockPrisma.chefProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "active", verificationStatus: "verified", isPublic: true }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "chef_profile.verified" }));
  });

  it("country manager cannot manage chefs outside assigned countries", async () => {
    mockPrisma.chefProfile.findUnique.mockResolvedValue({
      id: "chef-profile-2",
      countryCode: "IN",
      organizationId: "chef-org-2",
      status: "pending",
      verificationStatus: "pending",
    });

    await expect(getAdminChefProfile(countryManagerSession, "chef-profile-2")).rejects.toThrow("Country is not assigned");
  });

  it("requesting a specific chef creates an assigned request", async () => {
    const deadline = new Date("2026-05-23T21:00:00.000Z");
    isFeatureEnabled.mockResolvedValue(true);
    mockPrisma.chefProfile.findFirst.mockResolvedValue({
      id: "chef-profile-1",
      organizationId: "chef-org-1",
      countryCode: "US",
      baseRegion: null,
      displayName: "Hyderabad Home Kitchen",
      status: "active",
      isPublic: true,
    });
    createHomeChefRequest.mockResolvedValue({
      id: "request-1",
      status: "submitted",
      acceptanceDeadlineAt: deadline,
      currencyCode: "USD",
    });
    mockPrisma.homeChefRequestOffer.create.mockResolvedValue({ id: "offer-1", status: "pending" });
    mockPrisma.homeChefRequest.update.mockResolvedValue({
      id: "request-1",
      assignedChefOrganizationId: "chef-org-1",
      assignedChefProfileId: "chef-profile-1",
      currentOfferId: "offer-1",
    });

    await requestSpecificChef({
      householdOrganizationId: "household-1",
      householdCountryCode: "US",
      householdCurrencyCode: "USD",
      actorUserId: "user-1",
      chefSlug: "hyderabad-home-kitchen",
      input: {
        requestType: "custom",
        title: "Sunday dinner",
        requestedDate: "2026-05-23",
        guestCount: 4,
      },
    });

    expect(createHomeChefRequest).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "household-1" }));
    expect(mockPrisma.homeChefRequestOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          homeChefRequestId: "request-1",
          chefProfileId: "chef-profile-1",
          offeredById: "user-1",
          status: "pending",
          offerType: "direct",
          responseDeadlineAt: deadline,
          currencyCode: "USD",
        }),
      }),
    );
    expect(mockPrisma.homeChefRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedChefOrganizationId: "chef-org-1",
          assignedChefProfileId: "chef-profile-1",
          currentOfferId: "offer-1",
          matchingStatus: "offered",
          status: "reviewing",
        }),
      }),
    );
  });

  it("country manager admin listing is scoped to assigned countries", async () => {
    mockPrisma.chefProfile.findMany.mockResolvedValue([]);

    await listAdminChefProfiles(countryManagerSession, {});

    expect(mockPrisma.chefProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ countryCode: { in: ["US"] } }),
      }),
    );
  });
});
