import { HomeChefAccessGrantType, Prisma } from "@prisma/client";
import { AccessDeniedError, hasPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { getCurrentSession } from "@/lib/session";
import { createAuditEvent } from "@/server/audit";
import { createAdminNotification } from "@/server/notifications/notification-service";
import {
  canRevealExactAddress,
  canRevealContact,
  canRevealCustomerName,
  getHomeChefPrivacyPolicyForRequest,
} from "./home-chef-booking-lock-service";
import {
  toAdminRequestView,
  toChefPreviewLocation,
  toChefLimitedRequestView,
  toChefLogisticsRequestView,
  toHouseholdRequestView,
  type HomeChefRequestWithPrivacyRelations,
} from "./home-chef-redaction";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

const ADMIN_ROLES = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"] as const;

const homeChefRequestViewArgs = Prisma.validator<Prisma.HomeChefRequestDefaultArgs>()({
  include: {
    recipe: { select: { id: true, name: true, slug: true } },
    mealPlan: { select: { id: true, name: true } },
    organization: { select: { id: true, name: true, countryCode: true, organizationType: true } },
    createdBy: { select: { id: true, fullName: true, email: true } },
    currentOffer: {
      include: { chefProfile: { select: { id: true, displayName: true, organizationId: true } } },
    },
    offers: {
      include: { chefProfile: { select: { id: true, displayName: true, organizationId: true } } },
      orderBy: { createdAt: "desc" },
    },
    messages: {
      include: { senderUser: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    },
    statusHistory: {
      include: { changedBy: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    },
    accessGrants: { orderBy: { grantedAt: "desc" } },
    contactProxySessions: { orderBy: { createdAt: "desc" } },
  },
});

export type HomeChefRequestViewerDto =
  | ReturnType<typeof toAdminRequestView>
  | ReturnType<typeof toHouseholdRequestView>
  | ReturnType<typeof toChefLimitedRequestView>
  | ReturnType<typeof toChefLogisticsRequestView>;

async function getRequest(requestId: string) {
  const request = await prisma.homeChefRequest.findUnique({
    where: { id: requestId },
    ...homeChefRequestViewArgs,
  });
  if (!request) throw new Error("Home chef request not found.");
  return request as HomeChefRequestWithPrivacyRelations;
}

async function getChefProfileForSession(session: Session) {
  if (!session.activeOrganization) return null;
  return prisma.chefProfile.findUnique({
    where: { organizationId: session.activeOrganization.id },
    select: { id: true, organizationId: true, displayName: true },
  });
}

async function auditBlocked(session: Session, request: HomeChefRequestWithPrivacyRelations, reason: string) {
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: session.activeOrganization?.id ?? null,
    countryCode: request.countryCode,
    action: "home_chef_request.privacy_violation_blocked",
    targetType: "home_chef_request",
    targetId: request.id,
    details: { reason },
  });
  await createAdminNotification({
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    type: "home_chef_privacy_access_blocked",
    title: "Home Chef logistics access blocked",
    body: `A chef account attempted to access protected logistics for "${request.title}" before access was allowed.`,
    actionUrl: `/admin/home-chef-requests/${request.id}`,
    priority: "high",
    emailTemplateKey: "home_chef_request_status_updated",
  });
}

function isAdmin(session: Session) {
  return hasPlatformRole(session.user.platformRole, [...ADMIN_ROLES]);
}

function isHouseholdOwner(session: Session, request: HomeChefRequestWithPrivacyRelations) {
  return session.activeOrganization?.id === request.organizationId;
}

function chefHasOfferOrAssignment(
  request: HomeChefRequestWithPrivacyRelations,
  chefProfileId: string,
  chefOrganizationId?: string | null,
) {
  return (
    request.assignedChefProfileId === chefProfileId ||
    (Boolean(chefOrganizationId) && request.assignedChefOrganizationId === chefOrganizationId) ||
    (request.offers ?? []).some((offer) => offer.chefProfileId === chefProfileId)
  );
}

function chefAccepted(request: HomeChefRequestWithPrivacyRelations, chefProfileId: string) {
  return (
    (request.offers ?? []).some((offer) => offer.chefProfileId === chefProfileId && offer.status === "accepted") ||
    (request.assignedChefProfileId === chefProfileId && request.status === "accepted")
  );
}

async function ensureChefGrant(params: {
  request: HomeChefRequestWithPrivacyRelations;
  chefProfileId: string;
  userId: string;
  grantType: HomeChefAccessGrantType;
}) {
  const existing = await prisma.homeChefRequestAccessGrant.findFirst({
    where: {
      requestId: params.request.id,
      chefProfileId: params.chefProfileId,
      userId: params.userId,
      grantType: params.grantType,
      status: "active",
    },
    select: { id: true },
  });
  if (existing) return existing;

  const grant = await prisma.homeChefRequestAccessGrant.create({
    data: {
      requestId: params.request.id,
      chefProfileId: params.chefProfileId,
      userId: params.userId,
      grantType: params.grantType,
      status: "active",
      createdById: params.userId,
    },
    select: { id: true },
  });
  await createAuditEvent({
    actorUserId: params.userId,
    organizationId: params.request.organizationId,
    countryCode: params.request.countryCode,
    action: "home_chef_access_grant.created",
    targetType: "home_chef_request",
    targetId: params.request.id,
    details: { chefProfileId: params.chefProfileId, grantType: params.grantType },
  });
  return grant;
}

export async function getHomeChefRequestForViewer(params: {
  session: Session;
  requestId: string;
}): Promise<HomeChefRequestViewerDto> {
  const request = await getRequest(params.requestId);
  const policy = await getHomeChefPrivacyPolicyForRequest(request);

  if (isAdmin(params.session)) {
    return toAdminRequestView(request);
  }

  if (isHouseholdOwner(params.session, request)) {
    return toHouseholdRequestView(request);
  }

  const chefProfile = await getChefProfileForSession(params.session);
  if (!chefProfile || !chefHasOfferOrAssignment(request, chefProfile.id, params.session.activeOrganization?.id)) {
    await auditBlocked(params.session, request, "chef_not_assigned_or_offered");
    throw new AccessDeniedError("Home chef request is not available to this chef.", "MEMBERSHIP_REQUIRED");
  }

  const viewer = {
    userId: params.session.user.id,
    role: "chef" as const,
    organizationId: params.session.activeOrganization?.id,
    chefProfileId: chefProfile.id,
  };

  if (canRevealExactAddress(request, viewer, policy) || canRevealContact(request, viewer, policy) || canRevealCustomerName(request, viewer, policy)) {
    await createAuditEvent({
      actorUserId: params.session.user.id,
      organizationId: request.organizationId,
      countryCode: request.countryCode,
      action: "home_chef_request.viewed_logistics_by_chef",
      targetType: "home_chef_request",
      targetId: request.id,
      details: { chefProfileId: chefProfile.id },
    });
    return toChefLogisticsRequestView({ request, policy });
  }

  await ensureChefGrant({
    request,
    chefProfileId: chefProfile.id,
    userId: params.session.user.id,
    grantType: HomeChefAccessGrantType.limited_request_view,
  });
  if (policy?.allowPreAcceptanceMessaging ?? true) {
    await ensureChefGrant({
      request,
      chefProfileId: chefProfile.id,
      userId: params.session.user.id,
      grantType: HomeChefAccessGrantType.anonymous_messaging,
    });
  }
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: "home_chef_request.viewed_limited_by_chef",
    targetType: "home_chef_request",
    targetId: request.id,
    details: { chefProfileId: chefProfile.id },
  });

  return toChefLimitedRequestView({
    request,
    policy,
    accepted: chefAccepted(request, chefProfile.id),
  });
}

export async function listChefHomeChefRequestsForViewer(params: { session: Session }) {
  const chefProfile = await getChefProfileForSession(params.session);
  if (!chefProfile || !params.session.activeOrganization) return [];

  const requests = await prisma.homeChefRequest.findMany({
    where: {
      countryCode: params.session.activeOrganization.countryCode,
      OR: [
        { assignedChefProfileId: chefProfile.id },
        { assignedChefOrganizationId: params.session.activeOrganization.id },
        { offers: { some: { chefProfileId: chefProfile.id } } },
      ],
    },
    include: {
      recipe: { select: { id: true, name: true, slug: true } },
      currentOffer: { select: { id: true, status: true, responseDeadlineAt: true, chefProfileId: true } },
      offers: { select: { id: true, status: true, responseDeadlineAt: true, chefProfileId: true } },
    },
    orderBy: [{ requestedDate: "asc" }, { createdAt: "desc" }],
  });

  return requests.map((request) => ({
    id: request.id,
    title: request.title,
    requestType: request.requestType,
    status: request.status,
    bookingLockStatus: request.bookingLockStatus,
    requestedDate: request.requestedDate,
    requestedTimeWindow: request.requestedTimeWindow,
    guestCount: request.guestCount,
    generalLocation: toChefPreviewLocation(request),
    recipe: request.recipe,
    currentOffer: request.currentOffer,
    offerStatus: request.offers.find((offer) => offer.chefProfileId === chefProfile.id)?.status ?? null,
    responseDeadlineAt: request.offers.find((offer) => offer.chefProfileId === chefProfile.id)?.responseDeadlineAt ?? null,
  }));
}
