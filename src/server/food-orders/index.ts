import {
  FoodOrderStatus,
  OrganizationType,
  Prisma,
  SellerType,
  type FoodOrderSellerType,
  type PlatformRole,
  type UserStatus,
} from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import {
  adminFoodOrderStatusSchema,
  foodOrderCreateSchema,
  foodOrderMessageSchema,
  sellerFoodOrderStatusSchema,
} from "@/lib/validation/food-orders";
import { createAuditEvent } from "@/server/audit";
import { assertOrderAcceptanceLimit } from "@/server/billing";
import { recordFulfillmentEvent, resolveOrderFulfillment } from "@/server/fulfillment/fulfillment-service";
import { hasAcceptedLatestRequiredDocuments } from "@/server/legal/legal-service";
import type { EmailTemplateKey } from "@/server/notifications/email-service";
import { createAdminNotification, createNotification } from "@/server/notifications/notification-service";
import { redeemPromotion, validatePromotionForCheckout } from "@/server/promotions";
import { assertSellerGate } from "@/server/seller-verification-gates";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;
type MemberSession = Session & {
  activeOrganization: NonNullable<Session["activeOrganization"]>;
  activeMembership: NonNullable<Session["activeMembership"]>;
};

type AdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

const FOOD_ORDER_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];
const FOOD_ORDER_READ_ADMIN_ROLES: PlatformRole[] = [...FOOD_ORDER_ADMIN_ROLES, "auditor"];

const orderDetailArgs = Prisma.validator<Prisma.FoodOrderDefaultArgs>()({
  include: {
    items: { include: { menuItem: { select: { id: true, name: true, slug: true, status: true } } } },
    messages: { include: { sender: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: "asc" } },
    statusHistory: { include: { changedBy: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: "asc" } },
    fulfillmentEvents: { orderBy: { createdAt: "asc" } },
    customerOrganization: { select: { id: true, name: true, organizationType: true } },
    sellerOrganization: { select: { id: true, name: true, organizationType: true, slug: true } },
    customerUser: { select: { id: true, fullName: true, email: true } },
    pickupLocation: true,
    deliveryZone: true,
    fulfillmentTimeSlot: true,
  },
});

export type FoodOrderDetail = Prisma.FoodOrderGetPayload<typeof orderDetailArgs>;

export function canUseFoodOrdersForOrgType(organizationType: string) {
  return (
    organizationType === OrganizationType.household ||
    organizationType === OrganizationType.home_catering ||
    organizationType === OrganizationType.restaurant
  );
}

export async function canAccessFoodOrders(params: {
  organizationId: string | null;
  organizationType?: string | null;
  platformRole?: PlatformRole | null;
}) {
  if (params.platformRole && ["platform_owner", "platform_admin", "support_admin", "country_manager", "auditor"].includes(params.platformRole)) {
    return true;
  }
  if (!params.organizationType || !canUseFoodOrdersForOrgType(params.organizationType)) return false;
  if (params.organizationType === OrganizationType.restaurant) {
    return isFeatureEnabled("restaurant_profiles", params.organizationId);
  }
  if (params.organizationType === OrganizationType.home_catering) {
    return isFeatureEnabled("home_catering", params.organizationId);
  }
  return true;
}

export async function createFoodOrder(params: {
  session: MemberSession;
  input: unknown;
}) {
  if (params.session.activeOrganization.organizationType !== OrganizationType.household) {
    throw new Error("Only household organizations can submit food order requests.");
  }
  const parsed = foodOrderCreateSchema.parse(params.input);
  const item = await prisma.menuItem.findFirst({
    where: {
      id: parsed.menuItemId,
      status: "active",
      menu: { status: "active", visibility: "public" },
      organization: { status: { in: ["active", "paused"] } },
    },
    include: {
      organization: {
        include: {
          homeCateringProfile: true,
        },
      },
      menu: true,
    },
  });
  if (!item) throw new Error("This menu item is not available for order requests.");

  const sellerType = sellerTypeFromOrganization(item.organization.organizationType);
  await assertSellerCanReceiveOrders(item, sellerType);
  validateFulfillment(parsed.fulfillmentType, item);
  validateNotice(parsed.requestedDate ?? null, item.minimumNoticeHours);
  validateQuantity(parsed.quantity, item.minimumOrderQuantity);

  const subtotalAmount = item.priceAmount == null ? null : roundMoney(item.priceAmount * parsed.quantity);
  const promotion = subtotalAmount
    ? await validatePromotionForCheckout({
        code: parsed.promoCode,
        module: "food_order",
        userId: params.session.user.id,
        organizationId: params.session.activeOrganization.id,
        sellerOrganizationId: item.organizationId,
        countryCode: item.countryCode,
        city: parsed.deliveryCity ?? null,
        amount: subtotalAmount,
        currencyCode: item.currencyCode,
      })
    : null;
  const resolvedFulfillment = await resolveOrderFulfillment({
    sellerOrganizationId: item.organizationId,
    countryCode: item.countryCode,
    fulfillmentType: parsed.fulfillmentType,
    subtotalAmount,
    requestedDate: parsed.requestedDate ?? null,
    requestedTimeWindow: parsed.requestedTimeWindow ?? null,
    deliveryCity: parsed.deliveryCity ?? null,
    deliveryRegion: parsed.deliveryRegion ?? null,
    deliveryPostalCode: parsed.deliveryPostalCode ?? null,
    deliveryLatitude: parsed.deliveryLatitude ?? null,
    deliveryLongitude: parsed.deliveryLongitude ?? null,
  });
  const preparationMinutes = resolvedFulfillment.preparationMinutes ?? (item.minimumNoticeHours == null ? null : item.minimumNoticeHours * 60);
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.foodOrder.create({
      data: {
        organizationId: params.session.activeOrganization.id,
        customerOrganizationId: params.session.activeOrganization.id,
        customerUserId: params.session.user.id,
        sellerOrganizationId: item.organizationId,
        sellerType,
        countryCode: item.countryCode,
        status: "submitted",
        fulfillmentType: parsed.fulfillmentType,
        fulfillmentStatus: "scheduled",
        pickupLocationId: resolvedFulfillment.pickupLocationId ?? null,
        deliveryZoneId: resolvedFulfillment.deliveryZoneId ?? null,
        fulfillmentTimeSlotId: resolvedFulfillment.fulfillmentTimeSlotId ?? null,
        requestedDate: parsed.requestedDate ?? null,
        requestedTimeWindow: parsed.requestedTimeWindow ?? null,
        preparationMinutes,
        cutoffAt: resolvedFulfillment.cutoffAt ?? null,
        promisedReadyAt: resolvedFulfillment.promisedReadyAt ?? null,
        subtotalAmount,
        promotionCode: promotion?.promotion.code ?? null,
        promotionDiscountAmount: promotion?.discountAmount ?? null,
        platformCreditAppliedAmount: null,
        deliveryFeeAmount: resolvedFulfillment.deliveryFeeAmount ?? null,
        currencyCode: item.currencyCode,
        customerName: parsed.customerName ?? params.session.user.fullName,
        customerPhone: parsed.customerPhone ?? null,
        customerEmail: parsed.customerEmail ?? params.session.user.email,
        pickupAddressSnapshot: resolvedFulfillment.pickupAddressSnapshot ?? null,
        deliveryAddressLine1: parsed.deliveryAddressLine1 ?? null,
        deliveryAddressLine2: parsed.deliveryAddressLine2 ?? null,
        deliveryCity: parsed.deliveryCity ?? null,
        deliveryRegion: parsed.deliveryRegion ?? null,
        deliveryCountryCode: parsed.deliveryCountryCode ?? item.countryCode,
        deliveryPostalCode: parsed.deliveryPostalCode ?? null,
        deliveryLatitude: parsed.deliveryLatitude ?? null,
        deliveryLongitude: parsed.deliveryLongitude ?? null,
        deliveryProviderPlaceId: parsed.deliveryProviderPlaceId ?? null,
        customerNotes: parsed.customerNotes ?? null,
        items: {
          create: {
            menuItemId: item.id,
            nameSnapshot: item.name,
            quantity: parsed.quantity,
            unitPriceAmount: item.priceAmount,
            totalAmount: subtotalAmount,
            notes: parsed.itemNotes ?? null,
          },
        },
        statusHistory: {
          create: {
            newStatus: "submitted",
            changedById: params.session.user.id,
            note: "Customer submitted order request.",
          },
        },
      },
      ...orderDetailArgs,
    });
    if (promotion) {
      await redeemPromotion({
        ...promotion,
        userId: params.session.user.id,
        organizationId: params.session.activeOrganization.id,
        sellerOrganizationId: item.organizationId,
        countryCode: item.countryCode,
        city: parsed.deliveryCity ?? null,
        module: "food_order",
        moduleEntityId: created.id,
        currencyCode: item.currencyCode,
      });
    }
    return created;
  });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    action: "food_order.submitted",
    targetType: "food_order",
    targetId: order.id,
    details: { sellerOrganizationId: order.sellerOrganizationId, sellerType: order.sellerType, subtotalAmount, promotionCode: order.promotionCode, promotionDiscountAmount: order.promotionDiscountAmount },
  });
  await recordFulfillmentEvent({
    orderId: order.id,
    sellerOrganizationId: order.sellerOrganizationId,
    countryCode: order.countryCode,
    eventType: "scheduled",
    statusSnapshot: order.fulfillmentStatus,
    actorUserId: params.session.user.id,
    metadata: {
      fulfillmentType: order.fulfillmentType,
      pickupLocationId: order.pickupLocationId,
      deliveryZoneId: order.deliveryZoneId,
      deliveryFeeAmount: order.deliveryFeeAmount,
    },
  });
  await notifySellerMembers(order, "food_order.submitted", "New food order request", `${order.customerOrganization.name} submitted an order request.`, sellerOrderPath(order));
  await createAdminNotification({
    organizationId: order.sellerOrganizationId,
    countryCode: order.countryCode,
    type: "food_order.submitted",
    title: "New food order request",
    body: `${order.customerOrganization.name} submitted an order request to ${order.sellerOrganization.name}.`,
    actionUrl: `/admin/food-orders/${order.id}`,
    priority: "normal",
  });
  return order;
}

export async function listCustomerFoodOrders(organizationId: string) {
  return prisma.foodOrder.findMany({
    where: { customerOrganizationId: organizationId },
    include: {
      items: true,
      sellerOrganization: { select: { id: true, name: true, organizationType: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSellerFoodOrders(organizationId: string) {
  return prisma.foodOrder.findMany({
    where: { sellerOrganizationId: organizationId },
    include: {
      items: true,
      customerOrganization: { select: { id: true, name: true } },
      customerUser: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerFoodOrder(organizationId: string, orderId: string) {
  return prisma.foodOrder.findFirst({ where: { id: orderId, customerOrganizationId: organizationId }, ...orderDetailArgs });
}

export async function getSellerFoodOrder(organizationId: string, orderId: string) {
  return prisma.foodOrder.findFirst({ where: { id: orderId, sellerOrganizationId: organizationId }, ...orderDetailArgs });
}

export async function cancelCustomerFoodOrder(params: {
  session: MemberSession;
  orderId: string;
  note?: string | null;
}) {
  const order = await getCustomerFoodOrder(params.session.activeOrganization.id, params.orderId);
  if (!order) throw new Error("Order not found.");
  if (!["submitted", "draft"].includes(order.status)) {
    throw new Error("This order can no longer be cancelled by the customer.");
  }
  const updated = await updateFoodOrderStatus({
    order,
    actorUserId: params.session.user.id,
    newStatus: "cancelled",
    note: params.note ?? "Customer cancelled order request.",
    sellerNotes: null,
    adminNotes: null,
  });
  await notifySellerMembers(updated, "food_order.cancelled", "Order request cancelled", `${updated.customerOrganization.name} cancelled an order request.`, sellerOrderPath(updated));
  return updated;
}

export async function updateSellerFoodOrderStatus(params: {
  session: MemberSession;
  orderId: string;
  input: unknown;
}) {
  if (
    params.session.activeOrganization.organizationType !== OrganizationType.home_catering &&
    params.session.activeOrganization.organizationType !== OrganizationType.restaurant
  ) {
    throw new Error("Seller organization is required.");
  }
  const parsed = sellerFoodOrderStatusSchema.parse(params.input);
  const order = await getSellerFoodOrder(params.session.activeOrganization.id, params.orderId);
  if (!order) throw new Error("Order not found.");
  if (parsed.status === "accepted") {
    const legalAcceptance = await hasAcceptedLatestRequiredDocuments(params.session);
    if (!legalAcceptance.accepted) {
      throw new Error("Accept the required seller agreements before accepting orders.");
    }
    await assertSellerGate({
      organizationId: params.session.activeOrganization.id,
      sellerType: order.sellerType === "home_catering" ? SellerType.home_catering : SellerType.restaurant,
      countryCode: order.countryCode,
      capability: "order_acceptance",
      message: "Seller verification is incomplete. Orders cannot be accepted yet.",
    });
    await assertOrderAcceptanceLimit(params.session.activeOrganization.id);
  }
  return updateFoodOrderStatus({
    order,
    actorUserId: params.session.user.id,
    newStatus: parsed.status,
    note: parsed.note ?? null,
    sellerNotes: parsed.sellerNotes ?? null,
    adminNotes: null,
  });
}

export async function updateAdminFoodOrderStatus(params: {
  session: AdminSession;
  orderId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, FOOD_ORDER_ADMIN_ROLES);
  const parsed = adminFoodOrderStatusSchema.parse(params.input);
  const order = await prisma.foodOrder.findUnique({ where: { id: params.orderId }, ...orderDetailArgs });
  if (!order) throw new Error("Order not found.");
  if (params.session.user.platformRole === "country_manager") assertCountryAccess(params.session, order.countryCode);
  return updateFoodOrderStatus({
    order,
    actorUserId: params.session.user.id,
    newStatus: parsed.status,
    note: parsed.note ?? null,
    sellerNotes: null,
    adminNotes: parsed.adminNotes ?? null,
  });
}

export async function createFoodOrderMessage(params: {
  session: MemberSession;
  orderId: string;
  input: unknown;
  audience: "customer" | "seller";
}) {
  const parsed = foodOrderMessageSchema.parse(params.input);
  const order = params.audience === "customer"
    ? await getCustomerFoodOrder(params.session.activeOrganization.id, params.orderId)
    : await getSellerFoodOrder(params.session.activeOrganization.id, params.orderId);
  if (!order) throw new Error("Order not found.");
  if (parsed.isInternal) throw new Error("Internal food order notes are admin-only.");
  const message = await prisma.foodOrderMessage.create({
    data: { orderId: order.id, senderUserId: params.session.user.id, message: parsed.message, isInternal: false },
  });
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: params.session.activeOrganization.id,
    countryCode: order.countryCode,
    action: "food_order.message_created",
    targetType: "food_order",
    targetId: order.id,
    details: { audience: params.audience },
  });
  if (params.audience === "customer") {
    await notifySellerMembers(order, "food_order.message_created", "New order message", `${order.customerOrganization.name} sent a message.`, sellerOrderPath(order));
  } else {
    const actionUrl = `/orders/${order.id}`;
    await createNotification({
      organizationId: order.customerOrganizationId,
      userId: order.customerUserId,
      countryCode: order.countryCode,
      type: "food_order.message_created",
      title: "New order message",
      body: `${order.sellerOrganization.name} sent a message about your order.`,
      actionUrl,
      priority: "normal",
      emailTemplateKey: "food_order_message_received",
      emailVariables: foodOrderEmailVariables(order, actionUrl),
    });
  }
  return message;
}

export async function listAdminFoodOrders(
  session: AdminSession,
  filters: { countryCode?: string; status?: string; sellerType?: string },
) {
  assertPlatformRole(session.user.platformRole, FOOD_ORDER_READ_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) assertCountryAccess(session, filters.countryCode);
  return prisma.foodOrder.findMany({
    where: {
      countryCode: isCountryManager ? filters.countryCode || { in: assignedCountries } : filters.countryCode || undefined,
      status: filters.status ? (filters.status as FoodOrderStatus) : undefined,
      sellerType: filters.sellerType ? (filters.sellerType as FoodOrderSellerType) : undefined,
    },
    include: {
      items: true,
      customerOrganization: { select: { id: true, name: true } },
      sellerOrganization: { select: { id: true, name: true, organizationType: true } },
      customerUser: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminFoodOrder(session: AdminSession, orderId: string) {
  assertPlatformRole(session.user.platformRole, FOOD_ORDER_READ_ADMIN_ROLES);
  const order = await prisma.foodOrder.findUnique({ where: { id: orderId }, ...orderDetailArgs });
  if (!order) return null;
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, order.countryCode);
  return order;
}

async function updateFoodOrderStatus(params: {
  order: FoodOrderDetail;
  actorUserId: string;
  newStatus: FoodOrderStatus;
  note: string | null;
  sellerNotes: string | null;
  adminNotes: string | null;
}) {
  const now = new Date();
  const updated = await prisma.foodOrder.update({
    where: { id: params.order.id },
    data: {
      status: params.newStatus,
      fulfillmentStatus: fulfillmentStatusFromFoodOrderStatus(params.newStatus),
      ...(params.sellerNotes !== null ? { sellerNotes: params.sellerNotes } : {}),
      ...(params.adminNotes !== null ? { adminNotes: params.adminNotes } : {}),
      ...(params.newStatus === "cancelled" ? { cancelledAt: now } : {}),
      ...(params.newStatus === "completed" ? { completedAt: now } : {}),
      statusHistory: {
        create: {
          oldStatus: params.order.status,
          newStatus: params.newStatus,
          changedById: params.actorUserId,
          note: params.note,
        },
      },
    },
    ...orderDetailArgs,
  });
  const action = statusAuditAction(params.newStatus);
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: updated.organizationId,
    countryCode: updated.countryCode,
    action,
    targetType: "food_order",
    targetId: updated.id,
    details: { oldStatus: params.order.status, newStatus: updated.status },
  });
  await recordFulfillmentEvent({
    orderId: updated.id,
    sellerOrganizationId: updated.sellerOrganizationId,
    countryCode: updated.countryCode,
    eventType: fulfillmentEventFromFoodOrderStatus(params.newStatus),
    statusSnapshot: updated.fulfillmentStatus,
    note: params.note,
    actorUserId: params.actorUserId,
    metadata: { oldStatus: params.order.status, newStatus: updated.status },
  });
  await notifyFoodOrderStatus(updated);
  return updated;
}

function sellerTypeFromOrganization(organizationType: OrganizationType): FoodOrderSellerType {
  if (organizationType === OrganizationType.home_catering) return "home_catering";
  if (organizationType === OrganizationType.restaurant) return "restaurant";
  throw new Error("Orders can only be requested from home catering sellers or restaurants.");
}

async function assertSellerCanReceiveOrders(
  item: Prisma.MenuItemGetPayload<{ include: { organization: { include: { homeCateringProfile: true } }; menu: true } }>,
  sellerType: FoodOrderSellerType,
) {
  if (sellerType === "home_catering") {
    const profile = item.organization.homeCateringProfile;
    if (!profile || profile.status !== "active" || profile.verificationStatus !== "verified" || !profile.isPublic) {
      throw new Error("This home catering seller is not accepting public order requests.");
    }
  }
  if (sellerType === "restaurant" && item.organization.status !== "active") {
    throw new Error("This restaurant is not accepting order requests.");
  }
}

function validateFulfillment(fulfillmentType: string, item: { pickupAvailable: boolean; deliveryAvailable: boolean; preorderRequired: boolean }) {
  if (fulfillmentType === "pickup" && !item.pickupAvailable) throw new Error("Pickup is not available for this item.");
  if (fulfillmentType === "delivery" && !item.deliveryAvailable) throw new Error("Delivery is not available for this item.");
  if (fulfillmentType === "preorder" && !item.preorderRequired) throw new Error("Preorder is not required for this item. Choose pickup, delivery, or inquiry.");
}

function validateQuantity(quantity: number, minimumOrderQuantity: number | null) {
  const min = minimumOrderQuantity ?? 1;
  if (quantity < min) throw new Error(`Minimum order quantity is ${min}.`);
}

function validateNotice(requestedDate: Date | null, minimumNoticeHours: number | null) {
  if (!requestedDate || minimumNoticeHours == null) return;
  const earliest = Date.now() + minimumNoticeHours * 60 * 60 * 1000;
  if (requestedDate.getTime() < earliest) throw new Error(`This item requires at least ${minimumNoticeHours} hours notice.`);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function statusAuditAction(status: FoodOrderStatus) {
  if (status === "accepted") return "food_order.accepted";
  if (status === "declined") return "food_order.declined";
  if (status === "cancelled") return "food_order.cancelled";
  if (status === "completed") return "food_order.completed";
  return "food_order.status_changed";
}

function fulfillmentStatusFromFoodOrderStatus(status: FoodOrderStatus) {
  if (status === "accepted") return "accepted";
  if (status === "preparing") return "preparing";
  if (status === "ready_for_pickup") return "ready_for_pickup";
  if (status === "out_for_delivery") return "out_for_delivery";
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "declined") return "cancelled";
  return "scheduled";
}

function fulfillmentEventFromFoodOrderStatus(status: FoodOrderStatus) {
  if (status === "accepted") return "accepted";
  if (status === "preparing") return "preparing";
  if (status === "ready_for_pickup") return "ready_for_pickup";
  if (status === "out_for_delivery") return "out_for_delivery";
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "declined") return "cancelled";
  return "scheduled";
}

async function notifySellerMembers(order: FoodOrderDetail, type: string, title: string, body: string, actionUrl: string) {
  const members = await prisma.membership.findMany({
    where: { organizationId: order.sellerOrganizationId, status: "active" },
    select: { userId: true },
  });
  const emailTemplateKey = sellerFoodOrderEmailTemplateKey(order, type);
  await Promise.all(members.map((member) => createNotification({
    organizationId: order.sellerOrganizationId,
    userId: member.userId,
    countryCode: order.countryCode,
    type,
    title,
    body,
    actionUrl,
    priority: "normal",
    emailTemplateKey,
    emailVariables: foodOrderEmailVariables(order, actionUrl),
  })));
}

async function notifyFoodOrderStatus(order: FoodOrderDetail) {
  const actionUrl = `/orders/${order.id}`;
  await createNotification({
    organizationId: order.customerOrganizationId,
    userId: order.customerUserId,
    countryCode: order.countryCode,
    type: "food_order.status_changed",
    title: "Food order status updated",
    body: `${order.sellerOrganization.name} marked your order ${order.status.replace(/_/g, " ")}.`,
    actionUrl,
    priority: order.status === "declined" || order.status === "cancelled" ? "high" : "normal",
    emailTemplateKey: customerFoodOrderStatusEmailTemplateKey(order.status),
    emailVariables: foodOrderEmailVariables(order, actionUrl),
  });
}

export function sellerOrderPath(order: Pick<FoodOrderDetail, "id" | "sellerType">) {
  return order.sellerType === "home_catering" ? `/catering/orders/${order.id}` : `/restaurant/orders/${order.id}`;
}

function sellerFoodOrderEmailTemplateKey(order: FoodOrderDetail, type: string): EmailTemplateKey | undefined {
  if (type === "food_order.submitted") {
    return order.sellerType === "home_catering" ? "catering_new_order" : "restaurant_new_order";
  }
  if (type === "food_order.cancelled") {
    return order.sellerType === "home_catering" ? "catering_order_cancelled" : "restaurant_order_cancelled";
  }
  if (type === "food_order.message_created") return "food_order_message_received";
  return undefined;
}

function customerFoodOrderStatusEmailTemplateKey(status: FoodOrderStatus): EmailTemplateKey | undefined {
  const map: Partial<Record<FoodOrderStatus, EmailTemplateKey>> = {
    accepted: "food_order_accepted",
    declined: "food_order_declined",
    preparing: "food_order_preparing",
    ready_for_pickup: "food_order_ready_for_pickup",
    out_for_delivery: "food_order_out_for_delivery",
    completed: "food_order_completed",
    cancelled: "food_order_cancelled",
  };
  return map[status];
}

function foodOrderEmailVariables(order: FoodOrderDetail, actionUrl: string) {
  const totalAmount = roundMoney((order.subtotalAmount ?? 0) + (order.deliveryFeeAmount ?? 0) - (order.promotionDiscountAmount ?? 0));
  return {
    orderNumber: `NK-${order.id.slice(-8).toUpperCase()}`,
    orderStatus: order.status.replace(/_/g, " "),
    sellerName: order.sellerOrganization.name,
    customerName: order.customerOrganization.name,
    orderUrl: actionUrl,
    requestedDate: order.requestedDate ? order.requestedDate.toLocaleString("en-US", { timeZone: "America/Chicago" }) : "Not scheduled",
    fulfillmentType: order.fulfillmentType.replace(/_/g, " "),
    totalAmount: totalAmount.toFixed(2),
    currencyCode: order.currencyCode,
    primaryActionLabel: "View order",
  };
}
