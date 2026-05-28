import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    foodOrder: { findFirst: vi.fn() },
    homeChefRequest: { findFirst: vi.fn() },
    marketplaceReview: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    marketplaceReviewReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    membership: { findMany: vi.fn() },
    homeCateringProfile: { updateMany: vi.fn() },
    chefProfile: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    notification: { create: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
    user: { findUnique: vi.fn() },
    emailLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/server/notifications/notification-service", () => ({
  createNotification: vi.fn(),
  createAdminNotification: vi.fn(),
}));

import {
  createMarketplaceReview,
  createSellerReviewReply,
  getPublicSellerReviewSummary,
  listPublicSellerReviews,
  reportMarketplaceReview,
  updateAdminReviewStatus,
} from "@/server/trust/review-service";
import { createAdminNotification, createNotification } from "@/server/notifications/notification-service";

function householdSession() {
  return {
    user: { id: "user-1", email: "household@example.test", fullName: "Household", status: "active", platformRole: null },
    activeOrganization: { id: "household-org", name: "Household", organizationType: "household", countryCode: "US", status: "active" },
    activeMembership: { organizationId: "household-org", role: "org_owner", status: "active" },
  } as never;
}

function sellerSession(type: "home_catering" | "restaurant" = "home_catering") {
  return {
    user: { id: "seller-user", email: "seller@example.test", status: "active", platformRole: null },
    activeOrganization: { id: "seller-org", name: "Seller", organizationType: type, countryCode: "US", status: "active" },
    activeMembership: { organizationId: "seller-org", role: "org_owner", status: "active" },
  } as never;
}

function adminSession(role = "platform_owner") {
  return {
    user: { id: "admin-user", email: "admin@example.test", status: "active", platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

describe("reviews, reports, and trust moderation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.membership.findMany.mockResolvedValue([{ userId: "seller-user" }]);
    mockPrisma.marketplaceReview.create.mockImplementation(async ({ data }) => ({ id: "review-1", ...data }));
    mockPrisma.marketplaceReview.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } });
  });

  it("creates verified-purchase review only for completed food order", async () => {
    mockPrisma.foodOrder.findFirst.mockResolvedValue({
      id: "order-1",
      countryCode: "US",
      customerOrganizationId: "household-org",
      customerUserId: "user-1",
      sellerOrganizationId: "seller-org",
      sellerType: "home_catering",
      status: "completed",
    });

    await createMarketplaceReview({
      session: householdSession(),
      input: { foodOrderId: "order-1", rating: "5", title: "Excellent", comment: "Great biryani." },
    });

    expect(mockPrisma.marketplaceReview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        foodOrderId: "order-1",
        status: "pending",
        verifiedPurchase: true,
        sellerType: "home_catering",
      }),
    }));
    expect(createAdminNotification).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalled();
  });

  it("blocks reviews without completed food order", async () => {
    mockPrisma.foodOrder.findFirst.mockResolvedValue(null);
    await expect(createMarketplaceReview({
      session: householdSession(),
      input: { foodOrderId: "order-1", rating: "5" },
    })).rejects.toThrow("completed food order");
  });

  it("creates home chef review only for completed assigned request", async () => {
    mockPrisma.homeChefRequest.findFirst.mockResolvedValue({
      id: "request-1",
      countryCode: "US",
      organizationId: "household-org",
      createdById: "user-1",
      status: "completed",
      assignedChefOrganizationId: "chef-org",
    });

    await createMarketplaceReview({
      session: householdSession(),
      input: { homeChefRequestId: "request-1", rating: 4 },
    });

    expect(mockPrisma.marketplaceReview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        homeChefRequestId: "request-1",
        sellerOrganizationId: "chef-org",
        sellerType: "chef_business",
      }),
    }));
  });

  it("public review summary excludes hidden and removed statuses", async () => {
    await getPublicSellerReviewSummary("seller-org");
    expect(mockPrisma.marketplaceReview.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { sellerOrganizationId: "seller-org", status: "published", verifiedPurchase: true },
    }));
    await listPublicSellerReviews("seller-org");
    expect(mockPrisma.marketplaceReview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sellerOrganizationId: "seller-org", status: "published", verifiedPurchase: true },
    }));
  });

  it("seller can reply only to own review", async () => {
    mockPrisma.marketplaceReview.findFirst.mockResolvedValue({ id: "review-1", sellerOrganizationId: "seller-org", countryCode: "US", status: "published" });
    mockPrisma.marketplaceReview.update.mockResolvedValue({ id: "review-1", sellerReply: "Thank you!" });
    await createSellerReviewReply({ session: sellerSession(), input: { reviewId: "review-1", reply: "Thank you!" } });
    expect(mockPrisma.marketplaceReview.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "review-1", sellerOrganizationId: "seller-org" },
    }));
  });

  it("review reports create moderation queue item", async () => {
    mockPrisma.marketplaceReview.findFirst.mockResolvedValue({ id: "review-1", status: "published", countryCode: "US" });
    mockPrisma.marketplaceReviewReport.create.mockResolvedValue({ id: "report-1" });
    await reportMarketplaceReview({ session: householdSession(), input: { reviewId: "review-1", reason: "safety", details: "Concern" } });
    expect(mockPrisma.marketplaceReviewReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reason: "safety", reporterUserId: "user-1" }),
    }));
  });

  it("admin publishing recalculates seller average while hidden reviews stay excluded", async () => {
    mockPrisma.marketplaceReview.findUnique.mockResolvedValue({ id: "review-1", sellerOrganizationId: "seller-org", sellerType: "home_catering", countryCode: "US", status: "pending" });
    mockPrisma.marketplaceReview.update.mockResolvedValue({ id: "review-1", status: "published" });
    await updateAdminReviewStatus({ session: adminSession(), input: { reviewId: "review-1", status: "published" } });
    expect(mockPrisma.homeCateringProfile.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "seller-org" },
      data: { averageRating: 4.5, ratingCount: 2 },
    }));
  });
});
