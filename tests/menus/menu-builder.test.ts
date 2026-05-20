import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    menu: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    menuItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    menuItemAvailability: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
    sellerVerificationPolicy: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerPayoutAccount: { findFirst: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn() },
    featureFlag: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn() }));

import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAuditEvent } from "@/server/audit";
import {
  canAccessMenus,
  listPublicMenuItemsForOrganization,
  moderateMenuItem,
  upsertMenuItem,
} from "@/server/menus";
import { menuItemSchema } from "@/lib/validation/menus";

function adminSession(role = "platform_admin") {
  return {
    user: { id: "admin-1", email: "admin@example.test", status: "active", platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

describe("shared menu builder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    mockPrisma.menu.findFirst.mockResolvedValue({ id: "menu-1" });
    mockPrisma.menuItem.create.mockResolvedValue({
      id: "item-1",
      name: "Chicken Biryani",
      status: "active",
      category: "biryani",
    });
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", organizationType: "home_catering", countryCode: "US", status: "active" });
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
  });

  it("validates menu item input", () => {
    const result = menuItemSchema.safeParse({
      name: "Hyderabadi Chicken Dum Biryani tray",
      category: "catering_tray",
      priceAmount: "85",
      currencyCode: "usd",
      status: "active",
      pickupAvailable: "on",
      deliveryAvailable: "on",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currencyCode).toBe("USD");
      expect(result.data.priceAmount).toBe(85);
    }
  });

  it("home catering seller creates an organization-scoped menu item", async () => {
    await upsertMenuItem({
      organizationId: "catering-org",
      countryCode: "US",
      organizationType: "home_catering",
      actorUserId: "seller-1",
      input: {
        menuId: "menu-1",
        name: "Hyderabadi Chicken Dum Biryani tray",
        category: "catering_tray",
        currencyCode: "USD",
        status: "active",
        pickupAvailable: "on",
        deliveryAvailable: "on",
        availableDays: ["5", "6"],
      },
    });

    expect(mockPrisma.menuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "catering-org",
          countryCode: "US",
          menuId: "menu-1",
          status: "active",
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "menu_item.created" }));
  });

  it("restaurant creates an organization-scoped menu item", async () => {
    await upsertMenuItem({
      organizationId: "restaurant-org",
      countryCode: "US",
      organizationType: "restaurant",
      actorUserId: "restaurant-owner",
      input: {
        name: "Mutton Biryani",
        category: "biryani",
        currencyCode: "USD",
        status: "active",
        pickupAvailable: "on",
      },
    });
    expect(mockPrisma.menuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "restaurant-org" }),
      }),
    );
  });

  it("unverified seller cannot publish menu item when policy requires verification", async () => {
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([{
      id: "policy-1",
      policyName: "Strict marketplace policy",
      countryCode: "US",
      region: null,
      sellerType: "home_catering",
      status: "active",
      allowMenuPublishingBeforeVerification: false,
      allowPublicProfileBeforeVerification: false,
      allowOrderAcceptanceBeforeVerification: false,
      allowPayoutsBeforeVerification: false,
      requireAdminApproval: true,
      requireIdentityVerification: false,
      requireFoodHandlerCertificate: false,
      requireLocalPermit: false,
      requireKitchenReview: false,
      requireBackgroundCheck: false,
      requirePayoutOnboarding: false,
      updatedAt: new Date(),
    }]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue({ status: "submitted", items: [], foodSafetyCertificates: [], permits: [], kitchenReviews: [], backgroundChecks: [], identityVerifications: [] });

    await expect(upsertMenuItem({
      organizationId: "catering-org",
      countryCode: "US",
      organizationType: "home_catering",
      actorUserId: "seller-1",
      input: { name: "Haleem", category: "special", currencyCode: "USD", status: "active" },
    })).rejects.toThrow("Complete verification before publishing menu items.");
  });

  it("verified seller can publish menu item when policy requires verification", async () => {
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([{
      id: "policy-1",
      policyName: "Strict marketplace policy",
      countryCode: "US",
      region: null,
      sellerType: "home_catering",
      status: "active",
      allowMenuPublishingBeforeVerification: false,
      allowPublicProfileBeforeVerification: false,
      allowOrderAcceptanceBeforeVerification: false,
      allowPayoutsBeforeVerification: false,
      requireAdminApproval: true,
      requireIdentityVerification: false,
      requireFoodHandlerCertificate: false,
      requireLocalPermit: false,
      requireKitchenReview: false,
      requireBackgroundCheck: false,
      requirePayoutOnboarding: false,
      updatedAt: new Date(),
    }]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue({ status: "verified", items: [], foodSafetyCertificates: [], permits: [], kitchenReviews: [], backgroundChecks: [], identityVerifications: [] });

    await upsertMenuItem({
      organizationId: "catering-org",
      countryCode: "US",
      organizationType: "home_catering",
      actorUserId: "seller-1",
      input: { name: "Haleem", category: "special", currencyCode: "USD", status: "active" },
    });

    expect(mockPrisma.menuItem.create).toHaveBeenCalled();
  });

  it("seller cannot attach an item to another organization menu", async () => {
    mockPrisma.menu.findFirst.mockResolvedValue(null);
    await expect(upsertMenuItem({
      organizationId: "catering-org-a",
      countryCode: "US",
      organizationType: "home_catering",
      actorUserId: "seller-1",
      input: {
        menuId: "other-org-menu",
        name: "Double ka Meetha tray",
        category: "dessert",
        currencyCode: "USD",
      },
    })).rejects.toThrow("Menu not found");
  });

  it("public listing queries active and sold out items but hides drafts", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([]);
    await listPublicMenuItemsForOrganization("org-1");
    expect(mockPrisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          status: { in: ["active", "sold_out"] },
          menu: { status: "active", visibility: "public" },
        }),
      }),
    );
  });

  it("sold out item status creates the right audit event", async () => {
    mockPrisma.menuItem.create.mockResolvedValue({ id: "item-1", name: "Haleem", status: "sold_out", category: "special" });
    await upsertMenuItem({
      organizationId: "org-1",
      countryCode: "US",
      organizationType: "home_catering",
      actorUserId: "seller-1",
      input: { name: "Haleem", category: "special", currencyCode: "USD", status: "sold_out" },
    });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "menu_item.sold_out" }));
  });

  it("admin can moderate menu item status", async () => {
    mockPrisma.menuItem.findUnique.mockResolvedValue({
      id: "item-1",
      organizationId: "org-1",
      countryCode: "US",
      status: "active",
    });
    mockPrisma.menuItem.update.mockResolvedValue({
      id: "item-1",
      organizationId: "org-1",
      countryCode: "US",
      status: "paused",
    });
    await moderateMenuItem({
      session: adminSession(),
      menuItemId: "item-1",
      input: { status: "paused", reason: "Needs review" },
    });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "menu_item.moderated" }));
  });

  it("country manager cannot moderate unassigned country menu item", async () => {
    mockPrisma.menuItem.findUnique.mockResolvedValue({
      id: "item-1",
      organizationId: "org-1",
      countryCode: "GB",
      status: "active",
    });
    await expect(moderateMenuItem({
      session: adminSession("country_manager"),
      menuItemId: "item-1",
      input: { status: "paused" },
    })).rejects.toThrow();
  });

  it("feature disabled state requires owner feature and menus flag", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(canAccessMenus({ organizationId: "org-1", organizationType: "home_catering" })).resolves.toBe(false);
  });
});
