import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    homeCateringProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    featureFlag: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn() }));

import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAuditEvent } from "@/server/audit";
import {
  canAccessHomeCatering,
  isHomeCateringBusiness,
  listPublicHomeCateringProfiles,
  updateAdminHomeCateringProfileStatus,
  upsertHomeCateringProfile,
} from "@/server/home-catering";
import { registerSchema } from "@/lib/validation/auth";
import { getWorkspaceNavItems, getPlatformNavItems } from "@/lib/navigation";

function adminSession(role = "platform_admin") {
  return {
    user: { id: "admin-1", email: "admin@example.test", status: "active", platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

describe("home catering seller foundation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  });

  it("accepts home catering registration account type", () => {
    const result = registerSchema.safeParse({
      fullName: "Amina Khan",
      email: "amina@example.test",
      password: "Password1",
      organizationName: "Amina Catering",
      countryCode: "US",
      accountType: "catering",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.accountType).toBe("catering");
  });

  it("recognizes home catering organizations separately from chef businesses", () => {
    expect(isHomeCateringBusiness("home_catering")).toBe(true);
    expect(isHomeCateringBusiness("chef_business")).toBe(false);
  });

  it("uses the home_catering feature flag for regular organizations and lets admins bypass", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    await expect(canAccessHomeCatering({ organizationId: "org-1" })).resolves.toBe(false);
    await expect(canAccessHomeCatering({ organizationId: "org-1", platformRole: "platform_admin" })).resolves.toBe(true);
  });

  it("seller can create or update its own organization-scoped profile", async () => {
    mockPrisma.homeCateringProfile.findUnique.mockResolvedValue(null);
    mockPrisma.homeCateringProfile.upsert.mockResolvedValue({
      id: "profile-1",
      displayName: "Amina Catering",
      verificationStatus: "pending",
    });

    await upsertHomeCateringProfile({
      organizationId: "org-1",
      countryCode: "US",
      actorUserId: "user-1",
      input: {
        displayName: "Amina Catering",
        bio: "Prepared Hyderabadi dishes for pickup and preorder.",
        cuisineSpecialties: "biryani, haleem",
        languages: "English, Urdu",
        acceptsPickup: "on",
        acceptsDelivery: "",
        acceptsPreorders: "on",
        submitForVerification: "on",
      },
    });

    expect(mockPrisma.homeCateringProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        create: expect.objectContaining({
          organizationId: "org-1",
          countryCode: "US",
          verificationStatus: "pending",
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "home_catering_profile.submitted_for_verification",
    }));
  });

  it("public marketplace hides draft suspended and disabled profiles by query", async () => {
    mockPrisma.homeCateringProfile.findMany.mockResolvedValue([{ id: "profile-1", cuisineSpecialtiesJson: [] }]);
    await listPublicHomeCateringProfiles({ organizationId: "org-1", delivery: true });
    expect(mockPrisma.homeCateringProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
          verificationStatus: "verified",
          isPublic: true,
          acceptsDelivery: true,
        }),
      }),
    );
  });

  it("admin can verify and publish a home catering profile", async () => {
    mockPrisma.homeCateringProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      organizationId: "org-1",
      countryCode: "US",
      status: "draft",
      verificationStatus: "pending",
      adminNotes: null,
    });
    mockPrisma.homeCateringProfile.update.mockResolvedValue({
      id: "profile-1",
      status: "active",
      verificationStatus: "verified",
      isPublic: true,
    });

    await updateAdminHomeCateringProfileStatus({
      session: adminSession(),
      profileId: "profile-1",
      input: { status: "active", verificationStatus: "verified", isPublic: "on" },
    });

    expect(mockPrisma.homeCateringProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "active",
          verificationStatus: "verified",
          isPublic: true,
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "home_catering_profile.verified",
    }));
  });

  it("country manager cannot manage unassigned country profiles", async () => {
    mockPrisma.homeCateringProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      organizationId: "org-1",
      countryCode: "GB",
      status: "draft",
      verificationStatus: "pending",
      adminNotes: null,
    });

    await expect(updateAdminHomeCateringProfileStatus({
      session: adminSession("country_manager"),
      profileId: "profile-1",
      input: { status: "active" },
    })).rejects.toThrow();
  });

  it("household navigation includes browsing caterers but not seller dashboard", () => {
    const items = getWorkspaceNavItems({
      user: { platformRole: null },
      activeOrganization: { organizationType: "household" },
      activeMembership: { role: "org_owner" },
    } as never);
    expect(items.some((item) => item.href === "/caterers")).toBe(true);
    expect(items.some((item) => item.href === "/catering")).toBe(false);
  });

  it("home catering seller navigation shows seller tools only", () => {
    const items = getWorkspaceNavItems({
      user: { platformRole: null },
      activeOrganization: { organizationType: "home_catering" },
      activeMembership: { role: "org_owner" },
    } as never);
    expect(items.map((item) => item.href)).toEqual(["/catering", "/catering/profile", "/catering/settings"]);
  });

  it("platform admin navigation includes home catering moderation", () => {
    const items = getPlatformNavItems({
      user: { platformRole: "platform_admin" },
      activeOrganization: null,
      activeMembership: null,
    } as never);
    expect(items.some((item) => item.href === "/admin/home-catering")).toBe(true);
  });
});
