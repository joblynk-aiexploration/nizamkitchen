import {
  HomeChefAccessGrantStatus,
  HomeChefAccessGrantType,
  HomeChefBookingLockStatus,
  HomeChefRequestStatus,
  OrganizationRole,
  type HomeChefPrivacyPolicy,
  type HomeChefRequest,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { createAdminNotification, createNotification } from "@/server/notifications/notification-service";

const TERMINAL_REVOKE_STATUSES = new Set<HomeChefRequestStatus>(["cancelled", "declined"]);
const CHEF_NOTIFICATION_ROLES = [
  OrganizationRole.org_owner,
  OrganizationRole.org_admin,
  OrganizationRole.chef_owner,
  OrganizationRole.chef_staff,
] as const;

type Viewer = {
  userId?: string | null;
  role: "admin" | "household" | "chef" | "other";
  organizationId?: string | null;
  chefProfileId?: string | null;
};

type RevealRequest = Pick<
  HomeChefRequest,
  | "status"
  | "organizationId"
  | "assignedChefProfileId"
  | "bookingLockStatus"
  | "bookingLockedAt"
  | "addressAccessRevokedAt"
  | "contactAccessRevokedAt"
>;

export async function getHomeChefPrivacyPolicyForRequest(
  request: Pick<HomeChefRequest, "countryCode" | "region" | "city" | "requestType">,
) {
  const policies = await prisma.homeChefPrivacyPolicy.findMany({
    where: {
      status: "active",
      OR: [
        {
          countryCode: request.countryCode,
          region: request.region,
          city: request.city,
          requestType: request.requestType,
        },
        {
          countryCode: request.countryCode,
          region: request.region,
          city: request.city,
          requestType: null,
        },
        {
          countryCode: request.countryCode,
          region: request.region,
          city: null,
          requestType: request.requestType,
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
      { countryCode: "desc" },
      { region: "desc" },
      { city: "desc" },
      { requestType: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return policies[0] ?? null;
}

export async function evaluateBookingLock(requestId: string) {
  const request = await prisma.homeChefRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      confirmedAt: true,
      paidAt: true,
      paymentStatus: true,
      bookingLockStatus: true,
    },
  });
  if (!request) throw new Error("Home chef request not found.");
  if (TERMINAL_REVOKE_STATUSES.has(request.status)) return HomeChefBookingLockStatus.revoked;
  if (request.bookingLockStatus === "locked") return HomeChefBookingLockStatus.locked;
  if (request.status !== "accepted") return HomeChefBookingLockStatus.not_locked;
  if (!request.confirmedAt) return HomeChefBookingLockStatus.pending_household_confirmation;
  if (request.paidAt || request.paymentStatus === "paid") return HomeChefBookingLockStatus.locked;
  return HomeChefBookingLockStatus.pending_payment;
}

export async function lockBooking(requestId: string, reason: string, actorId: string | null) {
  const existing = await prisma.homeChefRequest.findUnique({
    where: { id: requestId },
    include: { assignedChefProfile: true },
  });
  if (!existing) throw new Error("Home chef request not found.");
  if (!existing.assignedChefProfileId || !existing.assignedChefProfile) {
    throw new Error("Assign a chef profile before locking booking logistics.");
  }
  if (TERMINAL_REVOKE_STATUSES.has(existing.status)) {
    throw new Error("Cancelled or declined requests cannot be locked.");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.homeChefRequest.update({
      where: { id: requestId },
      data: {
        bookingLockStatus: "locked",
        bookingLockedAt: now,
        bookingLockedById: actorId,
        bookingLockReason: reason,
        addressRevealedAt: now,
        addressAccessRevokedAt: null,
        contactAccessRevokedAt: null,
        confirmedAt: existing.confirmedAt ?? now,
        matchingStatus: "confirmed",
      },
    });
    await tx.homeChefRequestAccessGrant.createMany({
      data: [
        HomeChefAccessGrantType.full_logistics,
        HomeChefAccessGrantType.address_access,
        HomeChefAccessGrantType.contact_proxy,
      ].map((grantType) => ({
        requestId,
        chefProfileId: existing.assignedChefProfileId!,
        grantType,
        status: HomeChefAccessGrantStatus.active,
        createdById: actorId,
        grantedAt: now,
        expiresAt: grantType === HomeChefAccessGrantType.contact_proxy ? expiresAt : null,
      })),
    });
    await tx.contactProxySession.create({
      data: {
        requestId,
        householdUserId: existing.createdById,
        chefProfileId: existing.assignedChefProfileId!,
        status: "active",
        provider: "manual_placeholder",
        startsAt: now,
        expiresAt,
      },
    });
    return updated;
  });

  await createAuditEvent({
    actorUserId: actorId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_booking.locked",
    targetType: "home_chef_request",
    targetId: requestId,
    details: { reason, chefProfileId: existing.assignedChefProfileId },
  });
  await createAuditEvent({
    actorUserId: actorId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_address.revealed",
    targetType: "home_chef_request",
    targetId: requestId,
    details: { chefProfileId: existing.assignedChefProfileId, reveal: "booking_locked" },
  });
  await createAuditEvent({
    actorUserId: actorId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_contact_proxy.created",
    targetType: "home_chef_request",
    targetId: requestId,
    details: { chefProfileId: existing.assignedChefProfileId, provider: "manual_placeholder" },
  });
  await notifyBookingLocked(existing);

  return request;
}

export async function revokeBookingAccess(requestId: string, reason: string, actorId: string | null) {
  const existing = await prisma.homeChefRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new Error("Home chef request not found.");
  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.homeChefRequest.update({
      where: { id: requestId },
      data: {
        bookingLockStatus: "revoked",
        addressAccessRevokedAt: now,
        contactAccessRevokedAt: now,
      },
    });
    await tx.homeChefRequestAccessGrant.updateMany({
      where: {
        requestId,
        status: "active",
        grantType: { in: ["full_logistics", "address_access", "contact_proxy", "emergency_contact"] },
      },
      data: { status: "revoked", revokedAt: now, revokedReason: reason },
    });
    await tx.contactProxySession.updateMany({
      where: { requestId, status: { in: ["pending", "active"] } },
      data: { status: "revoked" },
    });
    return updated;
  });

  await createAuditEvent({
    actorUserId: actorId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_booking.unlocked",
    targetType: "home_chef_request",
    targetId: requestId,
    details: { reason },
  });
  await createAuditEvent({
    actorUserId: actorId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_address.revoked",
    targetType: "home_chef_request",
    targetId: requestId,
    details: { reason },
  });
  await createAuditEvent({
    actorUserId: actorId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_contact_proxy.revoked",
    targetType: "home_chef_request",
    targetId: requestId,
    details: { reason },
  });
  await notifyBookingAccessRevoked(existing, reason);

  return request;
}

export function canRevealExactAddress(
  request: RevealRequest,
  viewer: Viewer,
  policy?: Pick<HomeChefPrivacyPolicy, "revealExactAddressTrigger"> | null,
) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "household" && viewer.organizationId === request.organizationId) return true;
  if (viewer.role !== "chef") return false;
  if (viewer.chefProfileId !== request.assignedChefProfileId) return false;
  if (request.addressAccessRevokedAt || TERMINAL_REVOKE_STATUSES.has(request.status)) return false;
  if (policy?.revealExactAddressTrigger === "never") return false;
  if (request.status === "accepted") return true;
  return request.bookingLockStatus === "locked" && Boolean(request.bookingLockedAt);
}

export function canRevealCustomerName(
  request: RevealRequest,
  viewer: Viewer,
  policy?: Pick<HomeChefPrivacyPolicy, "revealCustomerNameTrigger"> | null,
) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "household" && viewer.organizationId === request.organizationId) return true;
  if (viewer.role !== "chef") return false;
  if (viewer.chefProfileId !== request.assignedChefProfileId) return false;
  if (policy?.revealCustomerNameTrigger === "never") return false;
  return request.bookingLockStatus === "locked" && Boolean(request.bookingLockedAt);
}

export function canRevealContact(
  request: RevealRequest,
  viewer: Viewer,
  policy?: Pick<HomeChefPrivacyPolicy, "allowPhoneProxyAfterLock" | "allowRealPhoneReveal" | "allowEmailReveal"> | null,
) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "household" && viewer.organizationId === request.organizationId) return true;
  if (viewer.role !== "chef") return false;
  if (viewer.chefProfileId !== request.assignedChefProfileId) return false;
  if (request.contactAccessRevokedAt || TERMINAL_REVOKE_STATUSES.has(request.status)) return false;
  return request.bookingLockStatus === "locked" && Boolean(policy?.allowPhoneProxyAfterLock);
}

export async function revokeExpiredHomeChefAccessGrants() {
  const now = new Date();
  const [grants, proxies] = await Promise.all([
    prisma.homeChefRequestAccessGrant.updateMany({
      where: { status: "active", expiresAt: { lte: now } },
      data: { status: "expired", revokedAt: now, revokedReason: "Expired automatically." },
    }),
    prisma.contactProxySession.updateMany({
      where: { status: "active", expiresAt: { lte: now } },
      data: { status: "expired" },
    }),
  ]);

  return { grantsExpired: grants.count, contactProxySessionsExpired: proxies.count };
}

export async function lockPaidHomeChefRequestsForPaymentOrder(paymentOrderId: string) {
  const homeChefRequest = prisma.homeChefRequest as typeof prisma.homeChefRequest & {
    findMany?: typeof prisma.homeChefRequest.findMany;
  };
  if (!homeChefRequest?.findMany) return [];

  const requests = await homeChefRequest.findMany({
    where: {
      paymentOrderId,
      status: "accepted",
      paymentStatus: "paid",
      bookingLockStatus: { not: "locked" },
      assignedChefProfileId: { not: null },
    },
    select: { id: true },
  });

  const locked: string[] = [];
  for (const request of requests) {
    try {
      await lockBooking(request.id, "Payment confirmed; booking locked by payment milestone.", null);
      locked.push(request.id);
    } catch (error) {
      await createAuditEvent({
        actorUserId: null,
        action: "home_chef_request.privacy_violation_blocked",
        targetType: "home_chef_request",
        targetId: request.id,
        details: { reason: "payment_lock_failed", message: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  }

  return locked;
}

async function notifyBookingLocked(request: HomeChefRequest) {
  await Promise.all([
    createNotification({
      organizationId: request.organizationId,
      userId: request.createdById,
      countryCode: request.countryCode,
      type: "home_chef_booking_locked",
      title: "Home chef booking confirmed",
      body: `Your booking "${request.title}" is confirmed. Logistics have been shared with your chef inside NizamKitchen.`,
      actionUrl: `/home-chef/requests/${request.id}`,
      priority: "high",
      emailTemplateKey: "home_chef_request_status_updated",
      preferenceKey: "homeChefUpdates",
    }),
    notifyChefOrganizationMembers({
      chefOrganizationId: request.assignedChefOrganizationId,
      householdOrganizationId: request.organizationId,
      countryCode: request.countryCode,
      type: "home_chef_booking_locked",
      title: "Booking confirmed. Logistics are available.",
      body: `The booking "${request.title}" is confirmed. Open NizamKitchen for logistics and keep customer communication on-platform.`,
      actionUrl: `/chef/requests/${request.id}`,
      priority: "high",
    }),
  ]);

}

async function notifyBookingAccessRevoked(request: HomeChefRequest, reason: string) {
  await Promise.all([
    createNotification({
      organizationId: request.organizationId,
      userId: request.createdById,
      countryCode: request.countryCode,
      type: "home_chef_booking_access_revoked",
      title: "Chef logistics access revoked",
      body: `Chef access to logistics for "${request.title}" has been revoked. Reason: ${reason}`,
      actionUrl: `/home-chef/requests/${request.id}`,
      priority: "high",
      emailTemplateKey: "home_chef_request_status_updated",
      preferenceKey: "homeChefUpdates",
    }),
    notifyChefOrganizationMembers({
      chefOrganizationId: request.assignedChefOrganizationId,
      householdOrganizationId: request.organizationId,
      countryCode: request.countryCode,
      type: "home_chef_booking_access_revoked",
      title: "Request cancelled. Logistics access revoked.",
      body: `The request "${request.title}" is no longer available for logistics access. Continue only through NizamKitchen support if follow-up is needed.`,
      actionUrl: `/chef/requests/${request.id}`,
      priority: "high",
    }),
    createAdminNotification({
      organizationId: request.organizationId,
      countryCode: request.countryCode,
      type: "home_chef_booking_access_revoked",
      title: "Home Chef logistics access revoked",
      body: `Logistics access was revoked for request "${request.title}". Reason: ${reason}`,
      actionUrl: `/admin/home-chef-requests/${request.id}`,
      priority: "high",
      emailTemplateKey: "home_chef_request_status_updated",
    }),
  ]);

}

async function notifyChefOrganizationMembers(input: {
  chefOrganizationId?: string | null;
  householdOrganizationId: string;
  countryCode: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string;
  priority: "low" | "normal" | "high" | "urgent";
}) {
  if (!input.chefOrganizationId) return [];

  const members = await prisma.membership.findMany({
    where: {
      organizationId: input.chefOrganizationId,
      status: "active",
      role: { in: [...CHEF_NOTIFICATION_ROLES] },
      user: { status: "active" },
    },
    select: { userId: true },
  });

  return Promise.all(
    members.map((member) =>
      createNotification({
        organizationId: input.householdOrganizationId,
        userId: member.userId,
        countryCode: input.countryCode,
        type: input.type,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl,
        priority: input.priority,
        emailTemplateKey: "home_chef_request_status_updated",
        preferenceKey: "homeChefUpdates",
      }),
    ),
  );
}
