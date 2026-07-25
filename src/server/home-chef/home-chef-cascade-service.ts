import {
  ChefProfileStatus,
  ChefVerificationStatus,
  HomeChefMatchingStatus,
  HomeChefRequestOfferStatus,
  HomeChefRequestOfferType,
  HomeChefRequestStatus,
  SellerType,
  type HomeChefAcceptancePolicy,
  type HomeChefRequest,
  type PlatformRole,
} from "@prisma/client";
import { z } from "zod";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { createNotification } from "@/server/notifications/notification-service";
import { assertSellerGate } from "@/server/seller-verification-gates";
import {
  calculateHomeChefAcceptanceDeadline,
  getDefaultHomeChefAcceptanceWindowMinutes,
} from "./lead-time";

const HOME_CHEF_ADMIN_ROLES: PlatformRole[] = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
];

type AdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

type PolicyLike = Pick<
  HomeChefAcceptancePolicy,
  | "acceptanceWindowMinutes"
  | "autoCascadeEnabled"
  | "maxCascadeAttempts"
  | "cascadeDelayMinutes"
  | "requireAdminReview"
  | "requireVerifiedChef"
> & { id: string | null };

export const homeChefAcceptancePolicySchema = z.object({
  countryCode: z.string().trim().toUpperCase().length(2).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  requestType: z.enum(["recipe", "meal_plan", "occasion", "weekly_cooking", "daily_cooking", "custom"]).optional().nullable(),
  leadTimeCategory: z.enum(["advance_booking", "short_term", "same_day", "recurring", "custom"]),
  acceptanceWindowMinutes: z.coerce.number().int().min(5).max(7 * 24 * 60),
  autoCascadeEnabled: z.coerce.boolean().default(true),
  maxCascadeAttempts: z.coerce.number().int().min(0).max(25).default(3),
  cascadeDelayMinutes: z.coerce.number().int().min(0).max(24 * 60).default(10),
  requireAdminReview: z.coerce.boolean().default(true),
  requireVerifiedChef: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
});

export const homeChefOfferSchema = z.object({
  chefProfileId: z.string().min(1),
  responseWindowMinutes: z.coerce.number().int().min(5).max(7 * 24 * 60).optional(),
  offerType: z.enum(["direct", "cascade", "admin_override"]).default("direct"),
  quoteAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().min(0).max(1_000_000).nullable(),
  ).optional(),
  currencyCode: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().toUpperCase().length(3).nullable(),
  ).optional(),
  adminNotes: z.string().trim().max(1200).optional().nullable(),
});

export const homeChefOfferResponseSchema = z.object({
  message: z.string().trim().max(1200).optional().nullable(),
});

export async function listHomeChefAcceptancePolicies(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, HOME_CHEF_ADMIN_ROLES);
  return prisma.homeChefAcceptancePolicy.findMany({
    orderBy: [
      { isActive: "desc" },
      { countryCode: "asc" },
      { region: "asc" },
      { city: "asc" },
      { requestType: "asc" },
      { leadTimeCategory: "asc" },
    ],
  });
}

export async function upsertHomeChefAcceptancePolicy(params: {
  session: AdminSession;
  policyId?: string | null;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, HOME_CHEF_ADMIN_ROLES);
  const parsed = homeChefAcceptancePolicySchema.parse(params.input);
  const data = {
    countryCode: parsed.countryCode || null,
    region: parsed.region || null,
    city: parsed.city || null,
    requestType: parsed.requestType || null,
    leadTimeCategory: parsed.leadTimeCategory,
    acceptanceWindowMinutes: parsed.acceptanceWindowMinutes,
    autoCascadeEnabled: parsed.autoCascadeEnabled,
    maxCascadeAttempts: parsed.maxCascadeAttempts,
    cascadeDelayMinutes: parsed.cascadeDelayMinutes,
    requireAdminReview: parsed.requireAdminReview,
    requireVerifiedChef: parsed.requireVerifiedChef,
    isActive: parsed.isActive,
  };

  const policy = params.policyId
    ? await prisma.homeChefAcceptancePolicy.update({
        where: { id: params.policyId },
        data: { ...data, updatedById: params.session.user.id },
      })
    : await prisma.homeChefAcceptancePolicy.create({
        data: { ...data, createdById: params.session.user.id },
      });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: null,
    countryCode: policy.countryCode,
    action: params.policyId ? "home_chef_acceptance_policy.updated" : "home_chef_acceptance_policy.created",
    targetType: "home_chef_acceptance_policy",
    targetId: policy.id,
    details: {
      leadTimeCategory: policy.leadTimeCategory,
      acceptanceWindowMinutes: policy.acceptanceWindowMinutes,
      autoCascadeEnabled: policy.autoCascadeEnabled,
    },
  });

  return policy;
}

export async function getHomeChefAcceptancePolicyForRequest(
  request: Pick<HomeChefRequest, "countryCode" | "region" | "city" | "requestType" | "leadTimeCategory">,
): Promise<PolicyLike> {
  const policies = await prisma.homeChefAcceptancePolicy.findMany({
    where: {
      isActive: true,
      leadTimeCategory: request.leadTimeCategory,
      OR: [
        {
          countryCode: request.countryCode,
          region: request.region ?? null,
          city: request.city ?? null,
          requestType: request.requestType,
        },
        {
          countryCode: request.countryCode,
          region: request.region ?? null,
          city: request.city ?? null,
          requestType: null,
        },
        {
          countryCode: request.countryCode,
          region: request.region ?? null,
          city: null,
          requestType: request.requestType,
        },
        {
          countryCode: request.countryCode,
          region: request.region ?? null,
          city: null,
          requestType: null,
        },
        {
          countryCode: request.countryCode,
          region: null,
          city: null,
          requestType: request.requestType,
        },
        {
          countryCode: request.countryCode,
          region: null,
          city: null,
          requestType: null,
        },
        {
          countryCode: null,
          region: null,
          city: null,
          requestType: request.requestType,
        },
        {
          countryCode: null,
          region: null,
          city: null,
          requestType: null,
        },
      ],
    },
    orderBy: [
      { city: "desc" },
      { region: "desc" },
      { countryCode: "desc" },
      { requestType: "desc" },
      { updatedAt: "desc" },
    ],
    take: 1,
  });

  const policy = policies[0];
  if (policy) return policy;
  return {
    id: null,
    acceptanceWindowMinutes: getDefaultHomeChefAcceptanceWindowMinutes(request.leadTimeCategory),
    autoCascadeEnabled: true,
    maxCascadeAttempts: 3,
    cascadeDelayMinutes: 10,
    requireAdminReview: true,
    requireVerifiedChef: true,
  };
}

export async function createHomeChefRequestOffer(params: {
  session: AdminSession;
  requestId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, HOME_CHEF_ADMIN_ROLES);
  const parsed = homeChefOfferSchema.parse(params.input);

  const request = await prisma.homeChefRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new Error("Home chef request not found.");
  if (["cancelled", "completed"].includes(request.status)) {
    throw new Error("Cancelled or completed requests cannot receive new chef offers.");
  }

  const chefProfile = await prisma.chefProfile.findFirst({
    where: {
      id: parsed.chefProfileId,
      countryCode: request.countryCode,
      status: ChefProfileStatus.active,
    },
    select: { id: true, organizationId: true, displayName: true, verificationStatus: true },
  });
  if (!chefProfile) throw new Error("Chef profile is not active in the request country.");

  const policy = await getHomeChefAcceptancePolicyForRequest(request);
  if (policy.requireVerifiedChef && chefProfile.verificationStatus !== ChefVerificationStatus.verified) {
    throw new Error("Chef verification is incomplete. This chef cannot receive the request yet.");
  }
  if (policy.requireVerifiedChef) {
    await assertSellerGate({
      organizationId: chefProfile.organizationId,
      sellerType: SellerType.chef_business,
      countryCode: request.countryCode,
      capability: "home_chef_assignment",
      message: "Chef verification is incomplete. This chef cannot receive the request yet.",
    });
  }

  const now = new Date();
  const windowMinutes = parsed.responseWindowMinutes ?? policy.acceptanceWindowMinutes;
  const responseDeadlineAt = calculateHomeChefAcceptanceDeadline(now, windowMinutes);

  const result = await prisma.$transaction(async (tx) => {
    await tx.homeChefRequestOffer.updateMany({
      where: { homeChefRequestId: request.id, status: HomeChefRequestOfferStatus.pending },
      data: { status: HomeChefRequestOfferStatus.cancelled, cancelledAt: now },
    });

    const offer = await tx.homeChefRequestOffer.create({
      data: {
        homeChefRequestId: request.id,
        chefProfileId: chefProfile.id,
        offeredById: params.session.user.id,
        status: HomeChefRequestOfferStatus.pending,
        offerType: parsed.offerType as HomeChefRequestOfferType,
        responseDeadlineAt,
        quoteAmount: parsed.quoteAmount ?? null,
        currencyCode: parsed.currencyCode ?? request.currencyCode,
        adminNotes: parsed.adminNotes ?? null,
      },
    });

    await tx.homeChefRequest.update({
      where: { id: request.id },
      data: {
        currentOfferId: offer.id,
        assignedChefProfileId: chefProfile.id,
        assignedChefOrganizationId: chefProfile.organizationId,
        acceptanceDeadlineAt: responseDeadlineAt,
        autoCascadeEnabled: policy.autoCascadeEnabled,
        nextCascadeAt: policy.autoCascadeEnabled
          ? calculateHomeChefAcceptanceDeadline(responseDeadlineAt, policy.cascadeDelayMinutes)
          : null,
        matchingStatus: HomeChefMatchingStatus.offered,
        status: request.status === HomeChefRequestStatus.draft ? HomeChefRequestStatus.submitted : request.status,
      },
    });

    await tx.homeChefRequestStatusHistory.create({
      data: {
        requestId: request.id,
        oldStatus: request.status,
        newStatus: request.status === HomeChefRequestStatus.draft ? HomeChefRequestStatus.submitted : request.status,
        changedById: params.session.user.id,
        note: `Offer sent to ${chefProfile.displayName}.`,
      },
    });

    return offer;
  });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: "home_chef_request.offer_created",
    targetType: "home_chef_request_offer",
    targetId: result.id,
    details: { requestId: request.id, chefProfileId: chefProfile.id, responseDeadlineAt },
  });

  await createNotification({
    organizationId: request.organizationId,
    userId: request.createdById,
    countryCode: request.countryCode,
    type: "home_chef_request_assigned",
    title: "Chef offer sent",
    body: `NizamKitchen sent your request "${request.title}" to ${chefProfile.displayName}.`,
    actionUrl: `/home-chef/requests/${request.id}`,
    priority: "high",
    emailTemplateKey: "home_chef_request_status_updated",
    preferenceKey: "homeChefUpdates",
  });

  return result;
}

export async function acceptHomeChefRequestOffer(params: {
  requestId: string;
  chefOrganizationId: string;
  countryCode: string;
  actorUserId: string;
  input?: unknown;
}) {
  const parsed = homeChefOfferResponseSchema.parse(params.input ?? {});
  const offer = await getChefOfferForRequest(params);
  const now = new Date();
  if (offer.status !== HomeChefRequestOfferStatus.pending) {
    throw new Error("This offer is no longer pending.");
  }
  if (offer.responseDeadlineAt < now) {
    await expireHomeChefOffer(offer.id, params.actorUserId);
    throw new Error("This offer has expired. Please wait for a new platform offer.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const acceptedOffer = await tx.homeChefRequestOffer.update({
      where: { id: offer.id },
      data: {
        status: HomeChefRequestOfferStatus.accepted,
        acceptedAt: now,
        responseMessage: parsed.message ?? null,
      },
    });
    await tx.homeChefRequestOffer.updateMany({
      where: {
        homeChefRequestId: offer.homeChefRequestId,
        id: { not: offer.id },
        status: HomeChefRequestOfferStatus.pending,
      },
      data: { status: HomeChefRequestOfferStatus.cancelled, cancelledAt: now },
    });
    await tx.homeChefRequest.update({
      where: { id: offer.homeChefRequestId },
      data: {
        status: HomeChefRequestStatus.accepted,
        matchingStatus: HomeChefMatchingStatus.chef_accepted,
        currentOfferId: offer.id,
        assignedChefProfileId: offer.chefProfileId,
        assignedChefOrganizationId: offer.chefProfile.organizationId,
        confirmedAt: now,
        nextCascadeAt: null,
      },
    });
    await tx.homeChefRequestStatusHistory.create({
      data: {
        requestId: offer.homeChefRequestId,
        oldStatus: offer.homeChefRequest.status,
        newStatus: HomeChefRequestStatus.accepted,
        changedById: params.actorUserId,
        note: parsed.message ?? "Accepted by chef.",
      },
    });
    return acceptedOffer;
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: offer.homeChefRequest.organizationId,
    countryCode: offer.homeChefRequest.countryCode,
    action: "home_chef_request_offer.accepted",
    targetType: "home_chef_request_offer",
    targetId: offer.id,
    details: { requestId: offer.homeChefRequestId, chefProfileId: offer.chefProfileId },
  });

  await createNotification({
    organizationId: offer.homeChefRequest.organizationId,
    userId: offer.homeChefRequest.createdById,
    countryCode: offer.homeChefRequest.countryCode,
    type: "home_chef_request_status_changed",
    title: "Chef accepted your request",
    body: `${offer.chefProfile.displayName} accepted "${offer.homeChefRequest.title}".`,
    actionUrl: `/home-chef/requests/${offer.homeChefRequestId}`,
    priority: "high",
    emailTemplateKey: "home_chef_request_status_updated",
    preferenceKey: "homeChefUpdates",
  });

  return updated;
}

export async function declineHomeChefRequestOffer(params: {
  requestId: string;
  chefOrganizationId: string;
  countryCode: string;
  actorUserId: string;
  input?: unknown;
}) {
  const parsed = homeChefOfferResponseSchema.parse(params.input ?? {});
  const offer = await getChefOfferForRequest(params);
  if (offer.status !== HomeChefRequestOfferStatus.pending) {
    throw new Error("This offer is no longer pending.");
  }

  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    await tx.homeChefRequestOffer.update({
      where: { id: offer.id },
      data: {
        status: HomeChefRequestOfferStatus.declined,
        declinedAt: now,
        responseMessage: parsed.message ?? null,
      },
    });
    const updated = await tx.homeChefRequest.update({
      where: { id: offer.homeChefRequestId },
      data: {
        matchingStatus: HomeChefMatchingStatus.chef_declined,
        nextCascadeAt: offer.homeChefRequest.autoCascadeEnabled ? now : null,
      },
    });
    await tx.homeChefRequestStatusHistory.create({
      data: {
        requestId: offer.homeChefRequestId,
        oldStatus: offer.homeChefRequest.status,
        newStatus: offer.homeChefRequest.status,
        changedById: params.actorUserId,
        note: parsed.message ?? "Declined by chef.",
      },
    });
    return updated;
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: offer.homeChefRequest.organizationId,
    countryCode: offer.homeChefRequest.countryCode,
    action: "home_chef_request_offer.declined",
    targetType: "home_chef_request_offer",
    targetId: offer.id,
    details: { requestId: offer.homeChefRequestId, chefProfileId: offer.chefProfileId },
  });
  await prisma.homeChefRequestAccessGrant.updateMany({
    where: {
      requestId: offer.homeChefRequestId,
      chefProfileId: offer.chefProfileId,
      status: "active",
    },
    data: {
      status: "revoked",
      revokedAt: now,
      revokedReason: "Chef declined the request offer.",
    },
  });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: offer.homeChefRequest.organizationId,
    countryCode: offer.homeChefRequest.countryCode,
    action: "home_chef_access_grant.revoked",
    targetType: "home_chef_request",
    targetId: offer.homeChefRequestId,
    details: { chefProfileId: offer.chefProfileId, reason: "offer_declined" },
  });

  return request;
}

export async function triggerHomeChefCascade(params: { session: AdminSession; requestId: string }) {
  assertPlatformRole(params.session.user.platformRole, HOME_CHEF_ADMIN_ROLES);
  const request = await prisma.homeChefRequest.findUnique({
    where: { id: params.requestId },
    include: { offers: { select: { chefProfileId: true } } },
  });
  if (!request) throw new Error("Home chef request not found.");

  const policy = await getHomeChefAcceptancePolicyForRequest(request);
  if (!policy.autoCascadeEnabled || request.cascadeAttemptCount >= policy.maxCascadeAttempts) {
    await prisma.homeChefRequest.update({
      where: { id: request.id },
      data: { matchingStatus: HomeChefMatchingStatus.no_chef_available, nextCascadeAt: null },
    });
    return null;
  }

  const excludedChefProfileIds = request.offers.map((offer) => offer.chefProfileId);
  const chefProfile = await prisma.chefProfile.findFirst({
    where: {
      countryCode: request.countryCode,
      status: ChefProfileStatus.active,
      verificationStatus: policy.requireVerifiedChef ? ChefVerificationStatus.verified : undefined,
      id: excludedChefProfileIds.length ? { notIn: excludedChefProfileIds } : undefined,
      OR: [
        request.city ? { baseCity: { equals: request.city, mode: "insensitive" } } : {},
        request.region ? { baseRegion: { equals: request.region, mode: "insensitive" } } : {},
        { isPublic: true },
      ],
    },
    orderBy: [{ ratingCount: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!chefProfile) {
    await prisma.homeChefRequest.update({
      where: { id: request.id },
      data: { matchingStatus: HomeChefMatchingStatus.no_chef_available, nextCascadeAt: null },
    });
    return null;
  }

  await prisma.homeChefRequest.update({
    where: { id: request.id },
    data: { cascadeAttemptCount: { increment: 1 } },
  });

  return createHomeChefRequestOffer({
    session: params.session,
    requestId: request.id,
    input: {
      chefProfileId: chefProfile.id,
      offerType: "cascade",
      responseWindowMinutes: policy.acceptanceWindowMinutes,
    },
  });
}

async function getChefOfferForRequest(params: {
  requestId: string;
  chefOrganizationId: string;
  countryCode: string;
}) {
  const offer = await prisma.homeChefRequestOffer.findFirst({
    where: {
      homeChefRequestId: params.requestId,
      homeChefRequest: { countryCode: params.countryCode },
      chefProfile: { organizationId: params.chefOrganizationId },
    },
    include: {
      chefProfile: { select: { id: true, displayName: true, organizationId: true } },
      homeChefRequest: {
        select: {
          id: true,
          organizationId: true,
          countryCode: true,
          createdById: true,
          title: true,
          status: true,
          autoCascadeEnabled: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!offer) throw new Error("Home chef offer not found.");
  return offer;
}

async function expireHomeChefOffer(offerId: string, actorUserId: string) {
  const now = new Date();
  await prisma.homeChefRequestOffer.update({
    where: { id: offerId },
    data: { status: HomeChefRequestOfferStatus.expired, expiredAt: now },
  });
  await createAuditEvent({
    actorUserId,
    organizationId: null,
    countryCode: null,
    action: "home_chef_request_offer.expired",
    targetType: "home_chef_request_offer",
    targetId: offerId,
    details: {},
  });
}
