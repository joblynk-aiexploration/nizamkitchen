import {
  HomeChefMessageSenderRole,
  HomeChefRequestStatus,
  OrganizationType,
  Prisma,
  SellerType,
  type PlatformRole,
  type UserStatus,
} from "@prisma/client";
import { assertCountryAccess, assertPlatformRole, hasPlatformRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import {
  homeChefRequestAssignmentSchema,
  homeChefRequestCreateSchema,
  homeChefRequestMessageSchema,
  homeChefRequestStatusSchema,
  homeChefRequestUpdateSchema,
} from "@/lib/validation/home-chef";
import { createAuditEvent } from "@/server/audit";
import { createNotification } from "@/server/notifications/notification-service";
import { assertSellerGate } from "@/server/seller-verification-gates";

const ADMIN_HOME_CHEF_ROLES: PlatformRole[] = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
];

const READ_HOME_CHEF_ROLES: PlatformRole[] = [...ADMIN_HOME_CHEF_ROLES, "auditor"];

const requestListArgs = Prisma.validator<Prisma.HomeChefRequestDefaultArgs>()({
  include: {
    recipe: { select: { id: true, name: true, slug: true } },
    mealPlan: { select: { id: true, name: true, startDate: true, endDate: true } },
    assignedChefOrganization: { select: { id: true, name: true, organizationType: true } },
    createdBy: { select: { id: true, fullName: true, email: true } },
    organization: { select: { id: true, name: true, organizationType: true, countryCode: true } },
    _count: { select: { messages: true, statusHistory: true } },
  },
});

const requestDetailArgs = Prisma.validator<Prisma.HomeChefRequestDefaultArgs>()({
  include: {
    recipe: { include: { cuisine: true } },
    mealPlan: {
      include: {
        days: {
          orderBy: { date: "asc" },
          include: {
            entries: {
              include: { recipe: { select: { id: true, name: true } } },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    },
    organization: {
      include: {
        householdProfile: true,
      },
    },
    createdBy: { select: { id: true, fullName: true, email: true } },
    assignedChefOrganization: { select: { id: true, name: true, organizationType: true, countryCode: true } },
    messages: {
      include: { senderUser: { select: { id: true, fullName: true, email: true, platformRole: true } } },
      orderBy: { createdAt: "asc" },
    },
    statusHistory: {
      include: { changedBy: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    },
  },
});

export type HomeChefRequestListItem = Prisma.HomeChefRequestGetPayload<typeof requestListArgs>;
export type HomeChefRequestDetail = Prisma.HomeChefRequestGetPayload<typeof requestDetailArgs>;

type AdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

function nullable<T>(value: T | null | undefined) {
  return value ?? null;
}

function normalizeCurrency(value: string | null | undefined, fallback: string) {
  return value?.toUpperCase() ?? fallback.toUpperCase();
}

export async function canAccessHomeChefs(params: {
  organizationId: string;
  platformRole: PlatformRole | null | undefined;
}) {
  if (hasPlatformRole(params.platformRole, ["platform_owner", "platform_admin", "support_admin"])) {
    return true;
  }

  return isFeatureEnabled("home_chefs", params.organizationId);
}

export function isHouseholdRequestOrganization(organizationType: string) {
  return organizationType === OrganizationType.household;
}

export function isChefOrganization(organizationType: string) {
  return organizationType === OrganizationType.chef_business;
}

async function ensureRecipeForOrganization(recipeId: string | undefined, organizationId: string) {
  if (!recipeId) return null;

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      OR: [
        { organizationId },
        { organizationId: null, isPublished: true, visibility: "global" },
      ],
    },
    select: { id: true, name: true },
  });

  if (!recipe) {
    throw new Error("Recipe is not available for this organization.");
  }

  return recipe;
}

async function ensureMealPlanForOrganization(mealPlanId: string | undefined, organizationId: string) {
  if (!mealPlanId) return null;

  const mealPlan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, organizationId },
    select: { id: true, name: true },
  });

  if (!mealPlan) {
    throw new Error("Meal plan is not available for this organization.");
  }

  return mealPlan;
}

async function getRequestScoped(requestId: string, organizationId: string) {
  const request = await prisma.homeChefRequest.findFirst({
    where: { id: requestId, organizationId },
    ...requestDetailArgs,
  });

  if (!request) {
    throw new Error("Home chef request not found.");
  }

  return request;
}

export async function listHomeChefRequests(organizationId: string) {
  return prisma.homeChefRequest.findMany({
    where: { organizationId },
    ...requestListArgs,
    orderBy: [{ requestedDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getHomeChefRequest(requestId: string, organizationId: string) {
  return getRequestScoped(requestId, organizationId);
}

export async function getChefHomeChefRequest(params: {
  requestId: string;
  chefOrganizationId: string;
  countryCode: string;
}) {
  const request = await prisma.homeChefRequest.findFirst({
    where: {
      id: params.requestId,
      assignedChefOrganizationId: params.chefOrganizationId,
      countryCode: params.countryCode,
    },
    ...requestDetailArgs,
  });

  if (!request) {
    throw new Error("Home chef order not found.");
  }

  return request;
}

export async function createHomeChefRequest(params: {
  organizationId: string;
  countryCode: string;
  createdById: string;
  defaultCurrencyCode: string;
  input: unknown;
}) {
  const parsed = homeChefRequestCreateSchema.parse(params.input);
  await ensureRecipeForOrganization(parsed.recipeId, params.organizationId);
  await ensureMealPlanForOrganization(parsed.mealPlanId, params.organizationId);

  const status = parsed.submit ? HomeChefRequestStatus.submitted : HomeChefRequestStatus.draft;
  const request = await prisma.homeChefRequest.create({
    data: {
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      createdById: params.createdById,
      status,
      requestType: parsed.requestType,
      title: parsed.title,
      description: nullable(parsed.description),
      mealPlanId: nullable(parsed.mealPlanId),
      recipeId: nullable(parsed.recipeId),
      requestedDate: parsed.requestedDate,
      requestedTimeWindow: nullable(parsed.requestedTimeWindow),
      guestCount: parsed.guestCount,
      householdSize: nullable(parsed.householdSize),
      serviceAddressLine1: nullable(parsed.serviceAddressLine1),
      serviceAddressLine2: nullable(parsed.serviceAddressLine2),
      city: nullable(parsed.city),
      region: nullable(parsed.region),
      postalCode: nullable(parsed.postalCode),
      phone: nullable(parsed.phone),
      preferredLanguage: nullable(parsed.preferredLanguage),
      genderPreference: parsed.genderPreference,
      budgetAmount: nullable(parsed.budgetAmount),
      budgetCurrency: normalizeCurrency(parsed.budgetCurrency, params.defaultCurrencyCode),
      notes: nullable(parsed.notes),
      statusHistory: {
        create: {
          newStatus: status,
          changedById: params.createdById,
          note: parsed.submit ? "Request submitted by household." : "Draft created by household.",
        },
      },
    },
  });

  await createAuditEvent({
    actorUserId: params.createdById,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "home_chef_request.created",
    targetType: "home_chef_request",
    targetId: request.id,
    details: { requestType: request.requestType, status: request.status, title: request.title },
  });

  if (status === HomeChefRequestStatus.submitted) {
    await createAuditEvent({
      actorUserId: params.createdById,
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      action: "home_chef_request.submitted",
      targetType: "home_chef_request",
      targetId: request.id,
      details: { requestType: request.requestType, title: request.title },
    });
    await createNotification({
      organizationId: params.organizationId,
      userId: params.createdById,
      countryCode: params.countryCode,
      type: "home_chef_request_submitted",
      title: "Home chef request submitted",
      body: `Your request "${request.title}" was submitted for support review.`,
      actionUrl: `/home-chef/requests/${request.id}`,
      priority: "normal",
      emailTemplateKey: "home_chef_request_submitted",
      preferenceKey: "homeChefUpdates",
    });
  }

  return request;
}

export async function updateHomeChefRequestDraft(params: {
  requestId: string;
  organizationId: string;
  actorUserId: string;
  defaultCurrencyCode: string;
  input: unknown;
}) {
  const existing = await getRequestScoped(params.requestId, params.organizationId);
  if (existing.status !== "draft") {
    throw new Error("Only draft requests can be edited by the household.");
  }

  const parsed = homeChefRequestUpdateSchema.parse(params.input);
  await ensureRecipeForOrganization(parsed.recipeId, params.organizationId);
  await ensureMealPlanForOrganization(parsed.mealPlanId, params.organizationId);

  const nextStatus = parsed.submit ? HomeChefRequestStatus.submitted : HomeChefRequestStatus.draft;
  const request = await prisma.homeChefRequest.update({
    where: { id: existing.id },
    data: {
      ...(parsed.requestType ? { requestType: parsed.requestType } : {}),
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: nullable(parsed.description) } : {}),
      ...(parsed.mealPlanId !== undefined ? { mealPlanId: nullable(parsed.mealPlanId) } : {}),
      ...(parsed.recipeId !== undefined ? { recipeId: nullable(parsed.recipeId) } : {}),
      ...(parsed.requestedDate ? { requestedDate: parsed.requestedDate } : {}),
      ...(parsed.requestedTimeWindow !== undefined
        ? { requestedTimeWindow: nullable(parsed.requestedTimeWindow) }
        : {}),
      ...(parsed.guestCount ? { guestCount: parsed.guestCount } : {}),
      ...(parsed.householdSize !== undefined ? { householdSize: nullable(parsed.householdSize) } : {}),
      ...(parsed.serviceAddressLine1 !== undefined
        ? { serviceAddressLine1: nullable(parsed.serviceAddressLine1) }
        : {}),
      ...(parsed.serviceAddressLine2 !== undefined
        ? { serviceAddressLine2: nullable(parsed.serviceAddressLine2) }
        : {}),
      ...(parsed.city !== undefined ? { city: nullable(parsed.city) } : {}),
      ...(parsed.region !== undefined ? { region: nullable(parsed.region) } : {}),
      ...(parsed.postalCode !== undefined ? { postalCode: nullable(parsed.postalCode) } : {}),
      ...(parsed.phone !== undefined ? { phone: nullable(parsed.phone) } : {}),
      ...(parsed.preferredLanguage !== undefined
        ? { preferredLanguage: nullable(parsed.preferredLanguage) }
        : {}),
      ...(parsed.genderPreference ? { genderPreference: parsed.genderPreference } : {}),
      ...(parsed.budgetAmount !== undefined ? { budgetAmount: nullable(parsed.budgetAmount) } : {}),
      ...(parsed.budgetCurrency !== undefined
        ? { budgetCurrency: normalizeCurrency(parsed.budgetCurrency, params.defaultCurrencyCode) }
        : {}),
      ...(parsed.notes !== undefined ? { notes: nullable(parsed.notes) } : {}),
      status: nextStatus,
    },
  });

  if (nextStatus !== existing.status) {
    await prisma.homeChefRequestStatusHistory.create({
      data: {
        requestId: existing.id,
        oldStatus: existing.status,
        newStatus: nextStatus,
        changedById: params.actorUserId,
        note: "Request submitted by household.",
      },
    });
  }

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: existing.countryCode,
    action: nextStatus === "submitted" ? "home_chef_request.submitted" : "home_chef_request.updated",
    targetType: "home_chef_request",
    targetId: request.id,
    details: { status: request.status, title: request.title },
  });
  if (nextStatus !== existing.status) {
    await createNotification({
      organizationId: existing.organizationId,
      userId: existing.createdById,
      countryCode: existing.countryCode,
      type: "home_chef_request_status_changed",
      title: "Home chef request submitted",
      body: `Your request "${existing.title}" changed from ${existing.status} to ${nextStatus}.`,
      actionUrl: `/home-chef/requests/${existing.id}`,
      priority: "high",
      emailTemplateKey: "home_chef_request_status_updated",
      preferenceKey: "homeChefUpdates",
    });
  }

  return request;
}

export async function cancelHomeChefRequest(params: {
  requestId: string;
  organizationId: string;
  actorUserId: string;
  note?: string | null;
}) {
  const existing = await getRequestScoped(params.requestId, params.organizationId);
  if (existing.status === "completed") {
    throw new Error("Completed requests cannot be cancelled.");
  }

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.homeChefRequest.update({
      where: { id: existing.id },
      data: { status: "cancelled" },
    });
    await tx.homeChefRequestStatusHistory.create({
      data: {
        requestId: existing.id,
        oldStatus: existing.status,
        newStatus: "cancelled",
        changedById: params.actorUserId,
        note: params.note ?? "Cancelled by household.",
      },
    });
    return updated;
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_request.cancelled",
    targetType: "home_chef_request",
    targetId: request.id,
    details: { previousStatus: existing.status },
  });
  return request;
}

export async function createHomeChefRequestMessage(params: {
  requestId: string;
  organizationId: string;
  actorUserId: string;
  senderRole: HomeChefMessageSenderRole;
  input: unknown;
}) {
  const request = await getRequestScoped(params.requestId, params.organizationId);
  const parsed = homeChefRequestMessageSchema.parse(params.input);
  if (params.senderRole === "household" && parsed.isInternal) {
    throw new Error("Household messages cannot be internal.");
  }

  const message = await prisma.homeChefRequestMessage.create({
    data: {
      requestId: request.id,
      senderUserId: params.actorUserId,
      senderRole: params.senderRole,
      message: parsed.message,
      isInternal: parsed.isInternal,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: "home_chef_request.message_created",
    targetType: "home_chef_request",
    targetId: request.id,
    details: { senderRole: params.senderRole, isInternal: parsed.isInternal },
  });
  if (!parsed.isInternal) {
    await createNotification({
      organizationId: request.organizationId,
      userId: request.createdById === params.actorUserId ? null : request.createdById,
      countryCode: request.countryCode,
      type: "home_chef_request_message",
      title: "New home chef request message",
      body: `A new ${params.senderRole} message was added to "${request.title}".`,
      actionUrl: `/home-chef/requests/${request.id}`,
      priority: "normal",
      emailTemplateKey: "home_chef_new_message",
      preferenceKey: "chefRequestMessages",
    });
  }

  return message;
}

export async function createChefHomeChefOrderMessage(params: {
  requestId: string;
  chefOrganizationId: string;
  countryCode: string;
  actorUserId: string;
  input: unknown;
}) {
  const request = await getChefHomeChefRequest({
    requestId: params.requestId,
    chefOrganizationId: params.chefOrganizationId,
    countryCode: params.countryCode,
  });
  const parsed = homeChefRequestMessageSchema.parse(params.input);

  const message = await prisma.homeChefRequestMessage.create({
    data: {
      requestId: request.id,
      senderUserId: params.actorUserId,
      senderRole: "chef",
      message: parsed.message,
      isInternal: false,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: "home_chef_order.message_created",
    targetType: "home_chef_request",
    targetId: request.id,
    details: { senderRole: "chef" },
  });

  await createNotification({
    organizationId: request.organizationId,
    userId: request.createdById,
    countryCode: request.countryCode,
    type: "home_chef_request_message",
    title: "New message from your chef",
    body: `Your chef added a message to "${request.title}".`,
    actionUrl: `/home-chef/requests/${request.id}`,
    priority: "normal",
    emailTemplateKey: "home_chef_new_message",
    preferenceKey: "chefRequestMessages",
  });

  return message;
}

export async function updateChefHomeChefOrderStatus(params: {
  requestId: string;
  chefOrganizationId: string;
  countryCode: string;
  actorUserId: string;
  status: "accepted" | "declined";
  note?: string | null;
}) {
  const existing = await getChefHomeChefRequest({
    requestId: params.requestId,
    chefOrganizationId: params.chefOrganizationId,
    countryCode: params.countryCode,
  });

  if (["cancelled", "completed"].includes(existing.status)) {
    throw new Error("This order can no longer be updated.");
  }
  if (existing.status === params.status) {
    return existing;
  }

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.homeChefRequest.update({
      where: { id: existing.id },
      data: { status: params.status },
    });
    await tx.homeChefRequestStatusHistory.create({
      data: {
        requestId: existing.id,
        oldStatus: existing.status,
        newStatus: params.status,
        changedById: params.actorUserId,
        note: params.note ?? (params.status === "accepted" ? "Accepted by chef." : "Declined by chef."),
      },
    });
    return updated;
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: params.status === "accepted" ? "home_chef_order.accepted" : "home_chef_order.declined",
    targetType: "home_chef_request",
    targetId: existing.id,
    details: { oldStatus: existing.status, newStatus: params.status },
  });

  await createNotification({
    organizationId: existing.organizationId,
    userId: existing.createdById,
    countryCode: existing.countryCode,
    type: "home_chef_request_status_changed",
    title: params.status === "accepted" ? "Chef accepted your order" : "Chef declined your order",
    body: `Your order "${existing.title}" was ${params.status} by the chef.`,
    actionUrl: `/home-chef/requests/${existing.id}`,
    priority: "high",
    emailTemplateKey: "home_chef_request_status_updated",
    preferenceKey: "homeChefUpdates",
  });

  return request;
}

export async function listAdminHomeChefRequests(
  session: AdminSession,
  filters: { countryCode?: string; status?: string; date?: string },
) {
  assertPlatformRole(session.user.platformRole, READ_HOME_CHEF_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) {
    assertCountryAccess(session, filters.countryCode);
  }

  return prisma.homeChefRequest.findMany({
    where: {
      countryCode: isCountryManager
        ? filters.countryCode || { in: assignedCountries }
        : filters.countryCode || undefined,
      status: filters.status ? (filters.status as HomeChefRequestStatus) : undefined,
      requestedDate: filters.date
        ? {
            gte: new Date(`${filters.date}T00:00:00.000Z`),
            lt: new Date(`${filters.date}T23:59:59.999Z`),
          }
        : undefined,
    },
    ...requestListArgs,
    orderBy: [{ requestedDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getAdminHomeChefRequest(session: AdminSession, requestId: string) {
  assertPlatformRole(session.user.platformRole, READ_HOME_CHEF_ROLES);
  const request = await prisma.homeChefRequest.findUnique({
    where: { id: requestId },
    ...requestDetailArgs,
  });

  if (!request) {
    throw new Error("Home chef request not found.");
  }

  if (session.user.platformRole === "country_manager") {
    assertCountryAccess(session, request.countryCode);
  }

  return request;
}

export async function updateAdminHomeChefRequestStatus(params: {
  session: AdminSession;
  requestId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, ADMIN_HOME_CHEF_ROLES);
  const parsed = homeChefRequestStatusSchema.parse(params.input);
  const existing = await getAdminHomeChefRequest(params.session, params.requestId);

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.homeChefRequest.update({
      where: { id: existing.id },
      data: { status: parsed.status, adminNotes: parsed.note ?? existing.adminNotes },
    });
    await tx.homeChefRequestStatusHistory.create({
      data: {
        requestId: existing.id,
        oldStatus: existing.status,
        newStatus: parsed.status,
        changedById: params.session.user.id,
        note: parsed.note,
      },
    });
    return updated;
  });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_request.status_changed",
    targetType: "home_chef_request",
    targetId: existing.id,
    details: { oldStatus: existing.status, newStatus: parsed.status },
  });

  await createNotification({
    organizationId: existing.organizationId,
    userId: existing.createdById,
    countryCode: existing.countryCode,
    type: "home_chef_request_status_changed",
    title: "Home chef request status updated",
    body: `Your request "${existing.title}" changed from ${existing.status} to ${parsed.status}.`,
    actionUrl: `/home-chef/requests/${existing.id}`,
    priority: parsed.status === "completed" ? "normal" : "high",
    emailTemplateKey: "home_chef_request_status_updated",
    preferenceKey: "homeChefUpdates",
  });

  return request;
}

export async function assignHomeChefRequest(params: {
  session: AdminSession;
  requestId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, ADMIN_HOME_CHEF_ROLES);
  const parsed = homeChefRequestAssignmentSchema.parse(params.input);
  const existing = await getAdminHomeChefRequest(params.session, params.requestId);

  if (parsed.assignedChefOrganizationId) {
    const chefOrg = await prisma.organization.findFirst({
      where: {
        id: parsed.assignedChefOrganizationId,
        organizationType: "chef_business",
        countryCode: existing.countryCode,
      },
      select: { id: true, name: true },
    });

    if (!chefOrg) {
      throw new Error("Assigned chef organization must be a chef business in the request country.");
    }
    await assertSellerGate({
      organizationId: chefOrg.id,
      sellerType: SellerType.chef_business,
      countryCode: existing.countryCode,
      capability: "home_chef_assignment",
      message: "Chef verification is incomplete. This chef cannot be assigned yet.",
    });
  }

  const nextStatus = parsed.assignedChefOrganizationId ? HomeChefRequestStatus.matched : existing.status;
  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.homeChefRequest.update({
      where: { id: existing.id },
      data: {
        assignedChefOrganizationId: parsed.assignedChefOrganizationId,
        adminNotes: parsed.note ?? existing.adminNotes,
        status: nextStatus,
      },
    });

    if (nextStatus !== existing.status) {
      await tx.homeChefRequestStatusHistory.create({
        data: {
          requestId: existing.id,
          oldStatus: existing.status,
          newStatus: nextStatus,
          changedById: params.session.user.id,
          note: parsed.note ?? "Chef organization assigned.",
        },
      });
    }

    return updated;
  });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "home_chef_request.assigned",
    targetType: "home_chef_request",
    targetId: existing.id,
    details: { assignedChefOrganizationId: parsed.assignedChefOrganizationId },
  });

  if (parsed.assignedChefOrganizationId) {
    await createNotification({
      organizationId: existing.organizationId,
      userId: existing.createdById,
      countryCode: existing.countryCode,
      type: "home_chef_request_assigned",
      title: "Chef assigned to your request",
      body: `A chef organization was assigned to "${existing.title}".`,
      actionUrl: `/home-chef/requests/${existing.id}`,
      priority: "high",
      emailTemplateKey: "home_chef_request_status_updated",
      preferenceKey: "homeChefUpdates",
    });
  }

  return request;
}

export async function createAdminHomeChefRequestMessage(params: {
  session: AdminSession;
  requestId: string;
  input: unknown;
}) {
  const request = await getAdminHomeChefRequest(params.session, params.requestId);
  return createHomeChefRequestMessage({
    requestId: request.id,
    organizationId: request.organizationId,
    actorUserId: params.session.user.id,
    senderRole: "admin",
    input: params.input,
  });
}

export async function listAssignedChefRequests(organizationId: string) {
  return prisma.homeChefRequest.findMany({
    where: { assignedChefOrganizationId: organizationId },
    ...requestListArgs,
    orderBy: [{ requestedDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function listChefRequestInbox(params: { organizationId: string; countryCode: string }) {
  return prisma.homeChefRequest.findMany({
    where: { assignedChefOrganizationId: params.organizationId, countryCode: params.countryCode },
    ...requestListArgs,
    orderBy: [{ requestedDate: "asc" }, { createdAt: "desc" }],
  });
}
