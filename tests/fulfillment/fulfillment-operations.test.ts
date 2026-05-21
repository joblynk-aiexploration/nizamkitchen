import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    fulfillmentPickupLocation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    fulfillmentDeliveryZone: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    fulfillmentTimeSlot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    foodOrder: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    foodOrderFulfillmentEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import {
  getSellerFulfillmentDashboard,
  recordFulfillmentEvent,
  resolveOrderFulfillment,
  saveDeliveryZone,
  savePickupLocation,
  saveTimeSlot,
} from "@/server/fulfillment/fulfillment-service";

function sellerSession(type: "home_catering" | "restaurant" = "home_catering") {
  return {
    user: { id: "seller-user", email: "seller@example.test", status: "active", platformRole: null },
    activeOrganization: { id: "seller-org", name: "Seller", organizationType: type, countryCode: "US", status: "active" },
    activeMembership: { organizationId: "seller-org", role: "org_owner", status: "active" },
  } as never;
}

describe("fulfillment operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.fulfillmentPickupLocation.findMany.mockResolvedValue([]);
    mockPrisma.fulfillmentPickupLocation.findFirst.mockResolvedValue(null);
    mockPrisma.fulfillmentPickupLocation.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.fulfillmentPickupLocation.create.mockImplementation(async ({ data }) => ({ id: "pickup-1", ...data }));
    mockPrisma.fulfillmentDeliveryZone.findMany.mockResolvedValue([]);
    mockPrisma.fulfillmentDeliveryZone.create.mockImplementation(async ({ data }) => ({ id: "zone-1", ...data }));
    mockPrisma.fulfillmentTimeSlot.findMany.mockResolvedValue([]);
    mockPrisma.fulfillmentTimeSlot.create.mockImplementation(async ({ data }) => ({ id: "slot-1", ...data }));
    mockPrisma.foodOrder.count.mockResolvedValue(0);
    mockPrisma.foodOrderFulfillmentEvent.create.mockImplementation(async ({ data }) => ({ id: "event-1", ...data }));
  });

  it("seller saves pickup location with Google place metadata and default reset", async () => {
    const saved = await savePickupLocation({
      session: sellerSession(),
      input: {
        label: "Main pickup",
        addressLine1: "123 Biryani Ln",
        city: "Dallas",
        countryCode: "US",
        latitude: "32.78",
        longitude: "-96.8",
        providerPlaceId: "place-1",
        isDefault: "true",
      },
    });
    expect(saved.providerPlaceId).toBe("place-1");
    expect(mockPrisma.fulfillmentPickupLocation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isDefault: false } }));
  });

  it("seller saves delivery zone with fees and postal matching", async () => {
    const saved = await saveDeliveryZone({
      session: sellerSession("restaurant"),
      input: {
        name: "Dallas delivery",
        city: "Dallas",
        postalCodes: "75001, 75002",
        deliveryFeeAmount: "7.5",
        minimumOrderAmount: "25",
        status: "active",
      },
    });
    expect(saved.deliveryFeeAmount).toBe(7.5);
    expect(mockPrisma.fulfillmentDeliveryZone.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ postalCodesJson: ["75001", "75002"] }),
    }));
  });

  it("delivery order resolves matching zone fee and active time slot", async () => {
    mockPrisma.fulfillmentDeliveryZone.findMany.mockResolvedValue([{
      id: "zone-1",
      countryCode: "US",
      city: "Dallas",
      region: "TX",
      postalCodesJson: ["75001"],
      centerLatitude: null,
      centerLongitude: null,
      radiusKm: null,
      minimumOrderAmount: 50,
      deliveryFeeAmount: 6,
      freeDeliveryAt: 200,
    }]);
    mockPrisma.fulfillmentTimeSlot.findMany.mockResolvedValue([{
      id: "slot-1",
      label: "Dinner",
      preparationMinutes: 45,
      cutoffMinutes: 120,
    }]);

    const resolved = await resolveOrderFulfillment({
      sellerOrganizationId: "seller-org",
      countryCode: "US",
      fulfillmentType: "delivery",
      subtotalAmount: 120,
      requestedDate: new Date("2026-05-22T18:00:00.000Z"),
      requestedTimeWindow: "Dinner",
      deliveryCity: "Dallas",
      deliveryRegion: "TX",
      deliveryPostalCode: "75001",
    });

    expect(resolved.deliveryZoneId).toBe("zone-1");
    expect(resolved.deliveryFeeAmount).toBe(6);
    expect(resolved.fulfillmentTimeSlotId).toBe("slot-1");
    expect(resolved.cutoffAt?.toISOString()).toBe("2026-05-22T16:00:00.000Z");
  });

  it("blocks delivery outside configured zones", async () => {
    mockPrisma.fulfillmentDeliveryZone.findMany.mockResolvedValue([{
      id: "zone-1",
      countryCode: "US",
      city: "Dallas",
      region: "TX",
      postalCodesJson: ["75001"],
      centerLatitude: null,
      centerLongitude: null,
      radiusKm: null,
      minimumOrderAmount: null,
      deliveryFeeAmount: 6,
      freeDeliveryAt: null,
    }]);

    await expect(resolveOrderFulfillment({
      sellerOrganizationId: "seller-org",
      countryCode: "US",
      fulfillmentType: "delivery",
      subtotalAmount: 80,
      deliveryCity: "Houston",
      deliveryPostalCode: "77001",
    })).rejects.toThrow("outside the seller's delivery zones");
  });

  it("time slot captures preparation and cutoff rules", async () => {
    const saved = await saveTimeSlot({
      session: sellerSession(),
      input: {
        label: "Friday dinner",
        slotType: "pickup",
        dayOfWeek: "5",
        startTime: "17:00",
        endTime: "19:00",
        preparationMinutes: "90",
        cutoffMinutes: "240",
      },
    });
    expect(saved.preparationMinutes).toBe(90);
    expect(saved.cutoffMinutes).toBe(240);
  });

  it("fulfillment dashboard scopes to seller organization", async () => {
    await getSellerFulfillmentDashboard(sellerSession());
    expect(mockPrisma.foodOrder.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sellerOrganizationId: "seller-org" }),
    }));
  });

  it("records fulfillment tracking events for orders", async () => {
    await recordFulfillmentEvent({
      orderId: "order-1",
      sellerOrganizationId: "seller-org",
      countryCode: "US",
      eventType: "ready_for_pickup",
      statusSnapshot: "ready_for_pickup",
      actorUserId: "seller-user",
    });
    expect(mockPrisma.foodOrderFulfillmentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "ready_for_pickup", orderId: "order-1" }),
    }));
  });
});
