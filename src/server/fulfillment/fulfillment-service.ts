import {
  FoodOrderFulfillmentType,
  FoodOrderStatus,
  FulfillmentEventType,
  FulfillmentRecordStatus,
  FulfillmentTimeSlotType,
  OrganizationType,
  Prisma,
  type PlatformRole,
  type UserStatus,
} from "@prisma/client";
import { z } from "zod";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { assertLocationLimit } from "@/server/billing/enforcement";

const FULFILLMENT_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];
const FULFILLMENT_MANAGE_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];

type MemberSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  activeOrganization: { id: string; name: string; organizationType: OrganizationType | string; countryCode: string; status: string };
  activeMembership: { organizationId: string; role: string; status: string };
};

type AdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

const nullableString = (max = 500) =>
  z.preprocess((value) => (value === "" || value == null ? null : String(value).trim()), z.string().max(max).nullable());

const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? null : Number(value)),
  z.number().finite().nullable(),
);

const statusSchema = z.enum(["active", "disabled", "archived"]).default("active");

export const pickupLocationSchema = z.object({
  id: nullableString(80).optional(),
  label: z.string().trim().min(1).max(120),
  instructions: nullableString(800).optional(),
  addressLine1: z.string().trim().min(1).max(220),
  addressLine2: nullableString(220).optional(),
  city: z.string().trim().min(1).max(120),
  region: nullableString(120).optional(),
  postalCode: nullableString(40).optional(),
  latitude: optionalNumber.optional(),
  longitude: optionalNumber.optional(),
  providerPlaceId: nullableString(180).optional(),
  timezone: nullableString(80).optional(),
  isDefault: z.coerce.boolean().default(false),
  status: statusSchema,
});

export const deliveryZoneSchema = z.object({
  id: nullableString(80).optional(),
  name: z.string().trim().min(1).max(140),
  description: nullableString(800).optional(),
  city: nullableString(120).optional(),
  region: nullableString(120).optional(),
  postalCodes: nullableString(800).optional(),
  centerLatitude: optionalNumber.optional(),
  centerLongitude: optionalNumber.optional(),
  radiusKm: optionalNumber.optional(),
  minimumOrderAmount: optionalNumber.optional(),
  deliveryFeeAmount: z.coerce.number().min(0).max(10000).default(0),
  freeDeliveryAt: optionalNumber.optional(),
  estimatedMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  status: statusSchema,
});

export const timeSlotSchema = z.object({
  id: nullableString(80).optional(),
  label: z.string().trim().min(1).max(120),
  slotType: z.enum(["pickup", "delivery", "preorder"]),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  capacity: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  preparationMinutes: z.coerce.number().int().min(0).max(10080).nullable().optional(),
  cutoffMinutes: z.coerce.number().int().min(0).max(10080).nullable().optional(),
  status: statusSchema,
});

export type ResolvedOrderFulfillment = {
  pickupLocationId?: string | null;
  pickupAddressSnapshot?: string | null;
  deliveryZoneId?: string | null;
  fulfillmentTimeSlotId?: string | null;
  deliveryFeeAmount?: number | null;
  preparationMinutes?: number | null;
  cutoffAt?: Date | null;
  promisedReadyAt?: Date | null;
};

export async function assertSellerFulfillmentAccess(session: MemberSession) {
  if (
    session.activeOrganization.organizationType !== OrganizationType.home_catering &&
    session.activeOrganization.organizationType !== OrganizationType.restaurant
  ) {
    throw new Error("Fulfillment tools are available only to home catering and restaurant organizations.");
  }
}

export async function getSellerFulfillmentDashboard(session: MemberSession) {
  await assertSellerFulfillmentAccess(session);
  const organizationId = session.activeOrganization.id;
  const [pickupLocations, deliveryZones, timeSlots, activeOrders, readyOrders] = await Promise.all([
    prisma.fulfillmentPickupLocation.findMany({ where: { organizationId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    prisma.fulfillmentDeliveryZone.findMany({ where: { organizationId }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.fulfillmentTimeSlot.findMany({ where: { organizationId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.foodOrder.count({ where: { sellerOrganizationId: organizationId, status: { in: ["submitted", "accepted", "preparing", "ready_for_pickup", "out_for_delivery"] } } }),
    prisma.foodOrder.count({ where: { sellerOrganizationId: organizationId, status: { in: ["ready_for_pickup", "out_for_delivery"] } } }),
  ]);
  return { pickupLocations, deliveryZones, timeSlots, activeOrders, readyOrders };
}

export async function listSellerPickupLocations(session: MemberSession) {
  await assertSellerFulfillmentAccess(session);
  return prisma.fulfillmentPickupLocation.findMany({
    where: { organizationId: session.activeOrganization.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function listSellerDeliveryZones(session: MemberSession) {
  await assertSellerFulfillmentAccess(session);
  return prisma.fulfillmentDeliveryZone.findMany({
    where: { organizationId: session.activeOrganization.id },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function listSellerTimeSlots(session: MemberSession) {
  await assertSellerFulfillmentAccess(session);
  return prisma.fulfillmentTimeSlot.findMany({
    where: { organizationId: session.activeOrganization.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

export async function savePickupLocation(params: { session: MemberSession; input: unknown }) {
  await assertSellerFulfillmentAccess(params.session);
  const parsed = pickupLocationSchema.parse(params.input);
  const organizationId = params.session.activeOrganization.id;
  const data = {
    organizationId,
    countryCode: params.session.activeOrganization.countryCode,
    label: parsed.label,
    instructions: parsed.instructions ?? null,
    addressLine1: parsed.addressLine1,
    addressLine2: parsed.addressLine2 ?? null,
    city: parsed.city,
    region: parsed.region ?? null,
    postalCode: parsed.postalCode ?? null,
    latitude: parsed.latitude ?? null,
    longitude: parsed.longitude ?? null,
    providerPlaceId: parsed.providerPlaceId ?? null,
    timezone: parsed.timezone ?? null,
    isDefault: parsed.isDefault,
    status: parsed.status as FulfillmentRecordStatus,
  };

  if (!parsed.id) {
    await assertLocationLimit(organizationId);
  }

  const saved = await prisma.$transaction(async (tx) => {
    if (parsed.isDefault) {
      await tx.fulfillmentPickupLocation.updateMany({ where: { organizationId }, data: { isDefault: false } });
    }
    if (parsed.id) {
      const existing = await tx.fulfillmentPickupLocation.findFirst({ where: { id: parsed.id, organizationId }, select: { id: true } });
      if (!existing) throw new Error("Pickup location not found.");
      return tx.fulfillmentPickupLocation.update({ where: { id: parsed.id }, data });
    }
    return tx.fulfillmentPickupLocation.create({ data });
  });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId,
    countryCode: params.session.activeOrganization.countryCode,
    action: "fulfillment.pickup_location.saved",
    targetType: "fulfillment_pickup_location",
    targetId: saved.id,
    details: { status: saved.status, isDefault: saved.isDefault },
  });
  return saved;
}

export async function saveDeliveryZone(params: { session: MemberSession; input: unknown }) {
  await assertSellerFulfillmentAccess(params.session);
  const parsed = deliveryZoneSchema.parse(params.input);
  const postalCodes = parsePostalCodes(parsed.postalCodes);
  const organizationId = params.session.activeOrganization.id;
  const data = {
    organizationId,
    countryCode: params.session.activeOrganization.countryCode,
    name: parsed.name,
    description: parsed.description ?? null,
    city: parsed.city ?? null,
    region: parsed.region ?? null,
    postalCodesJson: postalCodes.length > 0 ? postalCodes : Prisma.JsonNull,
    centerLatitude: parsed.centerLatitude ?? null,
    centerLongitude: parsed.centerLongitude ?? null,
    radiusKm: parsed.radiusKm ?? null,
    minimumOrderAmount: parsed.minimumOrderAmount ?? null,
    deliveryFeeAmount: roundMoney(parsed.deliveryFeeAmount),
    freeDeliveryAt: parsed.freeDeliveryAt ?? null,
    estimatedMinutes: parsed.estimatedMinutes ?? null,
    status: parsed.status as FulfillmentRecordStatus,
  };
  const saved = parsed.id
    ? await updateOwnedDeliveryZone(parsed.id, organizationId, data)
    : await prisma.fulfillmentDeliveryZone.create({ data });
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId,
    countryCode: params.session.activeOrganization.countryCode,
    action: "fulfillment.delivery_zone.saved",
    targetType: "fulfillment_delivery_zone",
    targetId: saved.id,
    details: { status: saved.status, deliveryFeeAmount: saved.deliveryFeeAmount },
  });
  return saved;
}

export async function saveTimeSlot(params: { session: MemberSession; input: unknown }) {
  await assertSellerFulfillmentAccess(params.session);
  const parsed = timeSlotSchema.parse(params.input);
  const organizationId = params.session.activeOrganization.id;
  const data = {
    organizationId,
    countryCode: params.session.activeOrganization.countryCode,
    label: parsed.label,
    slotType: parsed.slotType as FulfillmentTimeSlotType,
    dayOfWeek: parsed.dayOfWeek,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    capacity: parsed.capacity ?? null,
    preparationMinutes: parsed.preparationMinutes ?? null,
    cutoffMinutes: parsed.cutoffMinutes ?? null,
    status: parsed.status as FulfillmentRecordStatus,
  };
  const saved = parsed.id
    ? await updateOwnedTimeSlot(parsed.id, organizationId, data)
    : await prisma.fulfillmentTimeSlot.create({ data });
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId,
    countryCode: params.session.activeOrganization.countryCode,
    action: "fulfillment.time_slot.saved",
    targetType: "fulfillment_time_slot",
    targetId: saved.id,
    details: { slotType: saved.slotType, dayOfWeek: saved.dayOfWeek, status: saved.status },
  });
  return saved;
}

export async function resolveOrderFulfillment(params: {
  sellerOrganizationId: string;
  countryCode: string;
  fulfillmentType: FoodOrderFulfillmentType | string;
  subtotalAmount: number | null;
  requestedDate?: Date | null;
  requestedTimeWindow?: string | null;
  deliveryCity?: string | null;
  deliveryRegion?: string | null;
  deliveryPostalCode?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
}): Promise<ResolvedOrderFulfillment> {
  const [pickupLocation, timeSlot] = await Promise.all([
    params.fulfillmentType === "pickup" || params.fulfillmentType === "preorder"
      ? prisma.fulfillmentPickupLocation.findFirst({
          where: { organizationId: params.sellerOrganizationId, status: "active" },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        })
      : null,
    params.requestedDate
      ? findMatchingTimeSlot({
          sellerOrganizationId: params.sellerOrganizationId,
          fulfillmentType: params.fulfillmentType,
          requestedDate: params.requestedDate,
          requestedTimeWindow: params.requestedTimeWindow ?? null,
        })
      : null,
  ]);

  const resolved: ResolvedOrderFulfillment = {
    pickupLocationId: pickupLocation?.id ?? null,
    pickupAddressSnapshot: pickupLocation ? formatPickupAddress(pickupLocation) : null,
    fulfillmentTimeSlotId: timeSlot?.id ?? null,
    preparationMinutes: timeSlot?.preparationMinutes ?? null,
    cutoffAt: computeCutoff(params.requestedDate ?? null, timeSlot?.cutoffMinutes ?? null),
    promisedReadyAt: computePromisedReady(params.requestedDate ?? null, timeSlot?.preparationMinutes ?? null),
  };

  if (params.fulfillmentType !== "delivery") return resolved;

  const zones = await prisma.fulfillmentDeliveryZone.findMany({
    where: { organizationId: params.sellerOrganizationId, status: "active" },
    orderBy: [{ deliveryFeeAmount: "asc" }, { name: "asc" }],
  });
  if (zones.length === 0) return resolved;

  const matchedZone = zones.find((zone) => matchesDeliveryZone(zone, params));
  if (!matchedZone) {
    throw new Error("This delivery address is outside the seller's delivery zones.");
  }
  if (matchedZone.minimumOrderAmount != null && params.subtotalAmount != null && params.subtotalAmount < matchedZone.minimumOrderAmount) {
    throw new Error(`Delivery in ${matchedZone.name} requires a minimum order of ${matchedZone.minimumOrderAmount}.`);
  }
  return {
    ...resolved,
    deliveryZoneId: matchedZone.id,
    deliveryFeeAmount: computeDeliveryFee(matchedZone, params.subtotalAmount),
  };
}

export async function recordFulfillmentEvent(params: {
  orderId: string;
  sellerOrganizationId: string;
  countryCode: string;
  eventType: FulfillmentEventType | string;
  statusSnapshot?: string | null;
  note?: string | null;
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.foodOrderFulfillmentEvent.create({
    data: {
      orderId: params.orderId,
      organizationId: params.sellerOrganizationId,
      countryCode: params.countryCode,
      eventType: params.eventType as FulfillmentEventType,
      statusSnapshot: params.statusSnapshot ?? null,
      note: params.note ?? null,
      actorUserId: params.actorUserId ?? null,
      metadataJson: params.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function listAdminFulfillmentOrders(
  session: AdminSession,
  filters: { countryCode?: string; status?: string; fulfillmentType?: string },
) {
  assertPlatformRole(session.user.platformRole, FULFILLMENT_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) assertCountryAccess(session, filters.countryCode);
  return prisma.foodOrder.findMany({
    where: {
      countryCode: isCountryManager ? filters.countryCode || { in: assignedCountries } : filters.countryCode || undefined,
      status: filters.status ? (filters.status as FoodOrderStatus) : undefined,
      fulfillmentType: filters.fulfillmentType ? (filters.fulfillmentType as FoodOrderFulfillmentType) : undefined,
    },
    include: {
      items: true,
      sellerOrganization: { select: { id: true, name: true, organizationType: true } },
      customerOrganization: { select: { id: true, name: true } },
      pickupLocation: true,
      deliveryZone: true,
    },
    orderBy: [{ requestedDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function listAdminFulfillmentZones(session: AdminSession, filters: { countryCode?: string; status?: string }) {
  assertPlatformRole(session.user.platformRole, FULFILLMENT_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) assertCountryAccess(session, filters.countryCode);
  return prisma.fulfillmentDeliveryZone.findMany({
    where: {
      countryCode: isCountryManager ? filters.countryCode || { in: assignedCountries } : filters.countryCode || undefined,
      status: filters.status ? (filters.status as FulfillmentRecordStatus) : undefined,
    },
    include: { organization: { select: { id: true, name: true, organizationType: true } } },
    orderBy: [{ countryCode: "asc" }, { name: "asc" }],
  });
}

export async function getAdminFulfillmentDashboard(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, FULFILLMENT_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  const countryWhere = isCountryManager ? { in: assignedCountries } : undefined;
  const [activeOrders, readyOrders, activeZones, pickupLocations] = await Promise.all([
    prisma.foodOrder.count({ where: { countryCode: countryWhere, status: { in: ["submitted", "accepted", "preparing", "ready_for_pickup", "out_for_delivery"] } } }),
    prisma.foodOrder.count({ where: { countryCode: countryWhere, status: { in: ["ready_for_pickup", "out_for_delivery"] } } }),
    prisma.fulfillmentDeliveryZone.count({ where: { countryCode: countryWhere, status: "active" } }),
    prisma.fulfillmentPickupLocation.count({ where: { countryCode: countryWhere, status: "active" } }),
  ]);
  return { activeOrders, readyOrders, activeZones, pickupLocations };
}

export function assertAdminCanManageFulfillment(session: AdminSession, countryCode?: string | null) {
  assertPlatformRole(session.user.platformRole, FULFILLMENT_MANAGE_ADMIN_ROLES);
  if (session.user.platformRole === "country_manager" && countryCode) assertCountryAccess(session, countryCode);
}

async function updateOwnedDeliveryZone(
  id: string,
  organizationId: string,
  data: Prisma.FulfillmentDeliveryZoneUncheckedUpdateInput,
) {
  const existing = await prisma.fulfillmentDeliveryZone.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!existing) throw new Error("Delivery zone not found.");
  return prisma.fulfillmentDeliveryZone.update({ where: { id }, data });
}

async function updateOwnedTimeSlot(
  id: string,
  organizationId: string,
  data: Prisma.FulfillmentTimeSlotUncheckedUpdateInput,
) {
  const existing = await prisma.fulfillmentTimeSlot.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!existing) throw new Error("Time slot not found.");
  return prisma.fulfillmentTimeSlot.update({ where: { id }, data });
}

function parsePostalCodes(value?: string | null) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function matchesDeliveryZone(
  zone: {
    countryCode: string;
    city: string | null;
    region: string | null;
    postalCodesJson: Prisma.JsonValue;
    centerLatitude: number | null;
    centerLongitude: number | null;
    radiusKm: number | null;
  },
  params: {
    countryCode: string;
    deliveryCity?: string | null;
    deliveryRegion?: string | null;
    deliveryPostalCode?: string | null;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
  },
) {
  if (zone.countryCode !== params.countryCode) return false;
  const postalCodes = Array.isArray(zone.postalCodesJson) ? zone.postalCodesJson.map((item) => String(item).toUpperCase()) : [];
  if (params.deliveryPostalCode && postalCodes.includes(params.deliveryPostalCode.trim().toUpperCase())) return true;
  if (zone.city && params.deliveryCity && normalize(zone.city) === normalize(params.deliveryCity)) {
    return !zone.region || !params.deliveryRegion || normalize(zone.region) === normalize(params.deliveryRegion);
  }
  if (
    zone.centerLatitude != null &&
    zone.centerLongitude != null &&
    zone.radiusKm != null &&
    params.deliveryLatitude != null &&
    params.deliveryLongitude != null
  ) {
    return distanceKm(zone.centerLatitude, zone.centerLongitude, params.deliveryLatitude, params.deliveryLongitude) <= zone.radiusKm;
  }
  return false;
}

async function findMatchingTimeSlot(params: {
  sellerOrganizationId: string;
  fulfillmentType: string;
  requestedDate: Date;
  requestedTimeWindow: string | null;
}) {
  const dayOfWeek = params.requestedDate.getDay();
  const slotType = params.fulfillmentType === "delivery" ? "delivery" : params.fulfillmentType === "preorder" ? "preorder" : "pickup";
  const slots = await prisma.fulfillmentTimeSlot.findMany({
    where: {
      organizationId: params.sellerOrganizationId,
      slotType: slotType as FulfillmentTimeSlotType,
      dayOfWeek,
      status: "active",
    },
    orderBy: { startTime: "asc" },
  });
  if (slots.length === 0) return null;
  if (!params.requestedTimeWindow) return slots[0];
  return slots.find((slot) => normalize(slot.label) === normalize(params.requestedTimeWindow ?? "")) ?? slots[0];
}

function formatPickupAddress(location: { label: string; addressLine1: string; addressLine2: string | null; city: string; region: string | null; postalCode: string | null }) {
  return [location.label, location.addressLine1, location.addressLine2, location.city, location.region, location.postalCode].filter(Boolean).join(", ");
}

function computeDeliveryFee(zone: { deliveryFeeAmount: number; freeDeliveryAt: number | null }, subtotalAmount: number | null) {
  if (zone.freeDeliveryAt != null && subtotalAmount != null && subtotalAmount >= zone.freeDeliveryAt) return 0;
  return roundMoney(zone.deliveryFeeAmount);
}

function computeCutoff(requestedDate: Date | null, cutoffMinutes: number | null) {
  if (!requestedDate || cutoffMinutes == null) return null;
  return new Date(requestedDate.getTime() - cutoffMinutes * 60 * 1000);
}

function computePromisedReady(requestedDate: Date | null, preparationMinutes: number | null) {
  if (!requestedDate || preparationMinutes == null) return requestedDate;
  return new Date(requestedDate.getTime() + preparationMinutes * 60 * 1000);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
