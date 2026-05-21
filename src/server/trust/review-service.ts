import {
  MarketplaceReviewSellerType,
  MarketplaceReviewStatus,
  OrganizationType,
  type PlatformRole,
  type UserStatus,
} from "@prisma/client";
import { z } from "zod";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { createAdminNotification, createNotification } from "@/server/notifications/notification-service";

const TRUST_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];
const TRUST_MODERATOR_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];

type MemberSession = {
  user: { id: string; email: string; fullName?: string | null; status: UserStatus; platformRole: PlatformRole | null };
  activeOrganization: { id: string; name: string; organizationType: OrganizationType | string; countryCode: string; status: string };
  activeMembership: { organizationId: string; role: string; status: string };
};

type AdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

const nullableString = (max = 1000) =>
  z.preprocess((value) => (value === "" || value == null ? null : String(value).trim()), z.string().max(max).nullable());

export const reviewCreateSchema = z.object({
  foodOrderId: nullableString(120).optional(),
  homeChefRequestId: nullableString(120).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: nullableString(140).optional(),
  comment: nullableString(2000).optional(),
});

export const sellerReplySchema = z.object({
  reviewId: z.string().trim().min(1),
  reply: z.string().trim().min(1).max(1500),
});

export const reviewReportSchema = z.object({
  reviewId: z.string().trim().min(1),
  reason: z.enum(["abuse", "spam", "fake_review", "privacy", "safety", "other"]),
  details: nullableString(1500).optional(),
});

export const reviewModerationSchema = z.object({
  reviewId: z.string().trim().min(1),
  status: z.enum(["pending", "published", "hidden", "removed"]),
  moderationNote: nullableString(1000).optional(),
});

export const reportModerationSchema = z.object({
  reportId: z.string().trim().min(1),
  status: z.enum(["open", "under_review", "resolved", "dismissed"]),
  resolutionNote: nullableString(1000).optional(),
});

export async function createMarketplaceReview(params: { session: MemberSession; input: unknown }) {
  if (params.session.activeOrganization.organizationType !== OrganizationType.household) {
    throw new Error("Only household customers can review completed marketplace services.");
  }
  const parsed = reviewCreateSchema.parse(params.input);
  if (!!parsed.foodOrderId === !!parsed.homeChefRequestId) {
    throw new Error("Choose exactly one completed order or home chef request to review.");
  }

  if (parsed.foodOrderId) {
    return createFoodOrderReview({ session: params.session, foodOrderId: parsed.foodOrderId, parsed });
  }
  return createHomeChefRequestReview({ session: params.session, homeChefRequestId: parsed.homeChefRequestId!, parsed });
}

export async function createSellerReviewReply(params: { session: MemberSession; input: unknown }) {
  const parsed = sellerReplySchema.parse(params.input);
  const review = await prisma.marketplaceReview.findFirst({
    where: { id: parsed.reviewId, sellerOrganizationId: params.session.activeOrganization.id },
  });
  if (!review) throw new Error("Review not found.");
  if (review.status === "removed") throw new Error("Removed reviews cannot receive seller replies.");

  const updated = await prisma.marketplaceReview.update({
    where: { id: review.id },
    data: {
      sellerReply: parsed.reply,
      sellerReplyById: params.session.user.id,
      sellerRepliedAt: new Date(),
    },
  });
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: params.session.activeOrganization.id,
    countryCode: review.countryCode,
    action: "marketplace_review.seller_replied",
    targetType: "marketplace_review",
    targetId: review.id,
    details: { sellerOrganizationId: review.sellerOrganizationId },
  });
  return updated;
}

export async function reportMarketplaceReview(params: { session: MemberSession; input: unknown }) {
  const parsed = reviewReportSchema.parse(params.input);
  const review = await prisma.marketplaceReview.findFirst({ where: { id: parsed.reviewId, status: "published" } });
  if (!review) throw new Error("Review is not available for reporting.");
  const report = await prisma.marketplaceReviewReport.create({
    data: {
      reviewId: review.id,
      reporterUserId: params.session.user.id,
      reporterOrganizationId: params.session.activeOrganization.id,
      reason: parsed.reason,
      details: parsed.details ?? null,
    },
  });
  await createAdminNotification({
    organizationId: params.session.activeOrganization.id,
    countryCode: review.countryCode,
    type: "marketplace_review.reported",
    title: "Review report submitted",
    body: "A marketplace review was reported and is waiting in the moderation queue.",
    actionUrl: `/admin/reviews/${review.id}`,
    priority: "high",
  });
  return report;
}

export async function listPublicSellerReviews(sellerOrganizationId: string, limit = 8) {
  return prisma.marketplaceReview.findMany({
    where: {
      sellerOrganizationId,
      status: "published",
      verifiedPurchase: true,
    },
    include: {
      reviewer: { select: { fullName: true } },
      customerOrganization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getCustomerFoodOrderReview(foodOrderId: string, organizationId: string, reviewerUserId: string) {
  return prisma.marketplaceReview.findFirst({
    where: { foodOrderId, customerOrganizationId: organizationId, reviewerUserId },
    include: { reports: true },
  });
}

export async function getCustomerHomeChefRequestReview(homeChefRequestId: string, organizationId: string, reviewerUserId: string) {
  return prisma.marketplaceReview.findFirst({
    where: { homeChefRequestId, customerOrganizationId: organizationId, reviewerUserId },
    include: { reports: true },
  });
}

export async function getSellerReviewForFoodOrder(foodOrderId: string, sellerOrganizationId: string) {
  return prisma.marketplaceReview.findFirst({
    where: { foodOrderId, sellerOrganizationId },
    include: { reviewer: { select: { fullName: true } }, customerOrganization: { select: { name: true } } },
  });
}

export async function getPublicSellerReviewSummary(sellerOrganizationId: string) {
  const aggregate = await prisma.marketplaceReview.aggregate({
    where: { sellerOrganizationId, status: "published", verifiedPurchase: true },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return {
    averageRating: aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : null,
    ratingCount: aggregate._count.rating,
  };
}

export async function listAdminReviews(session: AdminSession, filters: { countryCode?: string; status?: string; sellerType?: string }) {
  assertPlatformRole(session.user.platformRole, TRUST_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) assertCountryAccess(session, filters.countryCode);
  return prisma.marketplaceReview.findMany({
    where: {
      countryCode: isCountryManager ? filters.countryCode || { in: assignedCountries } : filters.countryCode || undefined,
      status: filters.status ? (filters.status as MarketplaceReviewStatus) : undefined,
      sellerType: filters.sellerType ? (filters.sellerType as MarketplaceReviewSellerType) : undefined,
    },
    include: {
      sellerOrganization: { select: { id: true, name: true, organizationType: true } },
      customerOrganization: { select: { id: true, name: true } },
      reviewer: { select: { id: true, fullName: true, email: true } },
      reports: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getAdminReview(session: AdminSession, reviewId: string) {
  assertPlatformRole(session.user.platformRole, TRUST_ADMIN_ROLES);
  const review = await prisma.marketplaceReview.findUnique({
    where: { id: reviewId },
    include: {
      sellerOrganization: { select: { id: true, name: true, organizationType: true } },
      customerOrganization: { select: { id: true, name: true } },
      reviewer: { select: { id: true, fullName: true, email: true } },
      sellerReplyBy: { select: { id: true, fullName: true, email: true } },
      moderatedBy: { select: { id: true, fullName: true, email: true } },
      foodOrder: { select: { id: true, status: true } },
      homeChefRequest: { select: { id: true, status: true, title: true } },
      reports: { include: { reporter: { select: { fullName: true, email: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!review) return null;
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, review.countryCode);
  return review;
}

export async function updateAdminReviewStatus(params: { session: AdminSession; input: unknown }) {
  assertPlatformRole(params.session.user.platformRole, TRUST_MODERATOR_ROLES);
  const parsed = reviewModerationSchema.parse(params.input);
  const existing = await prisma.marketplaceReview.findUnique({ where: { id: parsed.reviewId } });
  if (!existing) throw new Error("Review not found.");
  if (params.session.user.platformRole === "country_manager") assertCountryAccess(params.session, existing.countryCode);
  const updated = await prisma.marketplaceReview.update({
    where: { id: existing.id },
    data: {
      status: parsed.status,
      moderationNote: parsed.moderationNote ?? null,
      moderatedById: params.session.user.id,
      moderatedAt: new Date(),
    },
  });
  await updateSellerRatingAggregate(existing.sellerOrganizationId, existing.sellerType);
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: existing.sellerOrganizationId,
    countryCode: existing.countryCode,
    action: `marketplace_review.${parsed.status}`,
    targetType: "marketplace_review",
    targetId: existing.id,
    details: { oldStatus: existing.status, newStatus: parsed.status },
  });
  return updated;
}

export async function listAdminReviewReports(session: AdminSession, filters: { status?: string }) {
  assertPlatformRole(session.user.platformRole, TRUST_ADMIN_ROLES);
  return prisma.marketplaceReviewReport.findMany({
    where: { status: filters.status ? (filters.status as never) : undefined },
    include: {
      review: { include: { sellerOrganization: { select: { name: true, countryCode: true } } } },
      reporter: { select: { fullName: true, email: true } },
      reporterOrganization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateAdminReviewReport(params: { session: AdminSession; input: unknown }) {
  assertPlatformRole(params.session.user.platformRole, TRUST_MODERATOR_ROLES);
  const parsed = reportModerationSchema.parse(params.input);
  const report = await prisma.marketplaceReviewReport.update({
    where: { id: parsed.reportId },
    data: { status: parsed.status, resolutionNote: parsed.resolutionNote ?? null, reviewedById: params.session.user.id, reviewedAt: new Date() },
    include: { review: true },
  });
  if (params.session.user.platformRole === "country_manager") assertCountryAccess(params.session, report.review.countryCode);
  return report;
}

async function createFoodOrderReview(params: {
  session: MemberSession;
  foodOrderId: string;
  parsed: z.infer<typeof reviewCreateSchema>;
}) {
  const order = await prisma.foodOrder.findFirst({
    where: {
      id: params.foodOrderId,
      customerOrganizationId: params.session.activeOrganization.id,
      customerUserId: params.session.user.id,
      status: "completed",
    },
  });
  if (!order) throw new Error("Reviews require a completed food order from your household.");
  const review = await prisma.marketplaceReview.create({
    data: {
      organizationId: params.session.activeOrganization.id,
      countryCode: order.countryCode,
      customerOrganizationId: order.customerOrganizationId,
      reviewerUserId: params.session.user.id,
      sellerOrganizationId: order.sellerOrganizationId,
      sellerType: order.sellerType === "home_catering" ? "home_catering" : "restaurant",
      subjectType: "food_order",
      foodOrderId: order.id,
      rating: params.parsed.rating,
      title: params.parsed.title ?? null,
      comment: params.parsed.comment ?? null,
      status: "pending",
      verifiedPurchase: true,
    },
  });
  await afterReviewCreated(params.session, review.id, order.countryCode, order.sellerOrganizationId);
  return review;
}

async function createHomeChefRequestReview(params: {
  session: MemberSession;
  homeChefRequestId: string;
  parsed: z.infer<typeof reviewCreateSchema>;
}) {
  const request = await prisma.homeChefRequest.findFirst({
    where: {
      id: params.homeChefRequestId,
      organizationId: params.session.activeOrganization.id,
      createdById: params.session.user.id,
      status: "completed",
      assignedChefOrganizationId: { not: null },
    },
  });
  if (!request?.assignedChefOrganizationId) throw new Error("Reviews require a completed home chef request assigned to a chef.");
  const review = await prisma.marketplaceReview.create({
    data: {
      organizationId: params.session.activeOrganization.id,
      countryCode: request.countryCode,
      customerOrganizationId: request.organizationId,
      reviewerUserId: params.session.user.id,
      sellerOrganizationId: request.assignedChefOrganizationId,
      sellerType: "chef_business",
      subjectType: "home_chef_request",
      homeChefRequestId: request.id,
      rating: params.parsed.rating,
      title: params.parsed.title ?? null,
      comment: params.parsed.comment ?? null,
      status: "pending",
      verifiedPurchase: true,
    },
  });
  await afterReviewCreated(params.session, review.id, request.countryCode, request.assignedChefOrganizationId);
  return review;
}

async function afterReviewCreated(session: MemberSession, reviewId: string, countryCode: string, sellerOrganizationId: string) {
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: session.activeOrganization.id,
    countryCode,
    action: "marketplace_review.created",
    targetType: "marketplace_review",
    targetId: reviewId,
    details: { sellerOrganizationId, verifiedPurchase: true },
  });
  await createAdminNotification({
    organizationId: sellerOrganizationId,
    countryCode,
    type: "marketplace_review.created",
    title: "New review pending moderation",
    body: "A verified-purchase review was submitted and needs moderation before publication.",
    actionUrl: `/admin/reviews/${reviewId}`,
    priority: "normal",
  });
  await notifySellerMembers(sellerOrganizationId, countryCode, reviewId);
}

async function notifySellerMembers(sellerOrganizationId: string, countryCode: string, reviewId: string) {
  const members = await prisma.membership.findMany({ where: { organizationId: sellerOrganizationId, status: "active" }, select: { userId: true } });
  await Promise.all(members.map((member) => createNotification({
    organizationId: sellerOrganizationId,
    userId: member.userId,
    countryCode,
    type: "marketplace_review.pending",
    title: "Review received",
    body: "A customer submitted a verified-purchase review. It will appear publicly after moderation.",
    actionUrl: `/admin/reviews/${reviewId}`,
    priority: "normal",
  })));
}

async function updateSellerRatingAggregate(sellerOrganizationId: string, sellerType: MarketplaceReviewSellerType) {
  const summary = await getPublicSellerReviewSummary(sellerOrganizationId);
  if (sellerType === "home_catering") {
    await prisma.homeCateringProfile.updateMany({
      where: { organizationId: sellerOrganizationId },
      data: { averageRating: summary.averageRating, ratingCount: summary.ratingCount },
    });
  }
  if (sellerType === "chef_business") {
    await prisma.chefProfile.updateMany({
      where: { organizationId: sellerOrganizationId },
      data: { averageRating: summary.averageRating, ratingCount: summary.ratingCount },
    });
  }
}

export function reviewStars(rating: number) {
  return "★".repeat(Math.max(0, Math.min(5, rating))) + "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, rating))));
}
