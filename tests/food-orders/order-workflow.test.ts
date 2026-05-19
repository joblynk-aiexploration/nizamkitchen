import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    menuItem: { findFirst: vi.fn() },
    foodOrder: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    foodOrderMessage: { create: vi.fn() },
    membership: { findMany: vi.fn() },
    featureFlag: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    emailLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/server/notifications/notification-service", () => ({
  createNotification: vi.fn(),
  createAdminNotification: vi.fn(),
}));

import { createAuditEvent } from "@/server/audit";
import { createAdminNotification, createNotification } from "@/server/notifications/notification-service";
import {
  createFoodOrder,
  listCustomerFoodOrders,
  listSellerFoodOrders,
  updateSellerFoodOrderStatus,
} from "@/server/food-orders";
import { foodOrderCreateSchema } from "@/lib/validation/food-orders";

function householdSession() {
  return {
    user: { id: "user-household", email: "household@example.test", fullName: "Household Owner", status: "active", platformRole: null },
    activeOrganization: { id: "household-org", name: "Nizam Family Kitchen", organizationType: "household", countryCode: "US", status: "active" },
    activeMembership: { organizationId: "household-org", role: "org_owner", status: "active" },
  } as never;
}

function sellerSession(type: "home_catering" | "restaurant" = "home_catering") {
  return {
    user: { id: "seller-user", email: "seller@example.test", fullName: "Seller Owner", status: "active", platformRole: null },
    activeOrganization: { id: "seller-org", name: "Seller", organizationType: type, countryCode: "US", status: "active" },
    activeMembership: { organizationId: "seller-org", role: "org_owner", status: "active" },
  } as never;
}

function activeMenuItem(type: "home_catering" | "restaurant" = "home_catering") {
  return {
    id: "menu-item-1",
    organizationId: "seller-org",
    countryCode: "US",
    name: "Hyderabadi Chicken Dum Biryani tray",
    priceAmount: 80,
    currencyCode: "USD",
    status: "active",
    pickupAvailable: true,
    deliveryAvailable: true,
    preorderRequired: true,
    minimumNoticeHours: 1,
    minimumOrderQuantity: 2,
    organization: {
      id: "seller-org",
      name: "Seller",
      organizationType: type,
      status: "active",
      homeCateringProfile: type === "home_catering"
        ? { status: "active", verificationStatus: "verified", isPublic: true }
        : null,
    },
    menu: { id: "menu-1", status: "active", visibility: "public" },
  };
}

function createdOrder(type: "home_catering" | "restaurant" = "home_catering") {
  return {
    id: "order-1",
    organizationId: "household-org",
    customerOrganizationId: "household-org",
    customerUserId: "user-household",
    sellerOrganizationId: "seller-org",
    sellerType: type,
    countryCode: "US",
    status: "submitted",
    currencyCode: "USD",
    subtotalAmount: 160,
    customerOrganization: { id: "household-org", name: "Nizam Family Kitchen", organizationType: "household" },
    sellerOrganization: { id: "seller-org", name: "Seller", organizationType: type, slug: "seller" },
    customerUser: { id: "user-household", fullName: "Household Owner", email: "household@example.test" },
    items: [],
    messages: [],
    statusHistory: [],
  };
}

describe("food order request workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.menuItem.findFirst.mockResolvedValue(activeMenuItem());
    mockPrisma.foodOrder.create.mockResolvedValue(createdOrder());
    mockPrisma.membership.findMany.mockResolvedValue([{ userId: "seller-user" }]);
  });

  it("validates order request input without payment data", () => {
    const result = foodOrderCreateSchema.safeParse({
      menuItemId: "menu-item-1",
      quantity: "2",
      fulfillmentType: "pickup",
      customerName: "Buyer",
      customerEmail: "buyer@example.test",
    });
    expect(result.success).toBe(true);
    const withPaymentNoise = foodOrderCreateSchema.safeParse({ menuItemId: "menu-item-1", quantity: "1", fulfillmentType: "pickup", paymentReference: "manual" });
    expect(withPaymentNoise.success).toBe(true);
    if (withPaymentNoise.success) expect("paymentReference" in withPaymentNoise.data).toBe(false);
  });

  it("household submits order for home catering item", async () => {
    await createFoodOrder({
      session: householdSession(),
      input: { menuItemId: "menu-item-1", quantity: 2, fulfillmentType: "pickup", requestedDate: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    });
    expect(mockPrisma.foodOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerOrganizationId: "household-org",
        sellerOrganizationId: "seller-org",
        sellerType: "home_catering",
        subtotalAmount: 160,
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "food_order.submitted" }));
    expect(createNotification).toHaveBeenCalled();
    expect(createAdminNotification).toHaveBeenCalled();
  });

  it("household submits order for restaurant item", async () => {
    mockPrisma.menuItem.findFirst.mockResolvedValue(activeMenuItem("restaurant"));
    mockPrisma.foodOrder.create.mockResolvedValue(createdOrder("restaurant"));
    await createFoodOrder({
      session: householdSession(),
      input: { menuItemId: "menu-item-1", quantity: 2, fulfillmentType: "delivery", requestedDate: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    });
    expect(mockPrisma.foodOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sellerType: "restaurant" }),
    }));
  });

  it("cannot order draft or inactive item", async () => {
    mockPrisma.menuItem.findFirst.mockResolvedValue(null);
    await expect(createFoodOrder({
      session: householdSession(),
      input: { menuItemId: "draft-item", quantity: 2, fulfillmentType: "pickup" },
    })).rejects.toThrow("not available");
  });

  it("cannot order from suspended seller", async () => {
    const item = activeMenuItem();
    item.organization.homeCateringProfile = { status: "suspended", verificationStatus: "verified", isPublic: true };
    mockPrisma.menuItem.findFirst.mockResolvedValue(item);
    await expect(createFoodOrder({
      session: householdSession(),
      input: { menuItemId: "menu-item-1", quantity: 2, fulfillmentType: "pickup" },
    })).rejects.toThrow("not accepting");
  });

  it("seller sees own orders only", async () => {
    mockPrisma.foodOrder.findMany.mockResolvedValue([]);
    await listSellerFoodOrders("seller-org");
    expect(mockPrisma.foodOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sellerOrganizationId: "seller-org" },
    }));
  });

  it("household sees own orders only", async () => {
    mockPrisma.foodOrder.findMany.mockResolvedValue([]);
    await listCustomerFoodOrders("household-org");
    expect(mockPrisma.foodOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerOrganizationId: "household-org" },
    }));
  });

  it("status change creates history and audit log", async () => {
    mockPrisma.foodOrder.findFirst.mockResolvedValue(createdOrder());
    mockPrisma.foodOrder.update.mockResolvedValue({ ...createdOrder(), status: "accepted" });
    await updateSellerFoodOrderStatus({
      session: sellerSession(),
      orderId: "order-1",
      input: { status: "accepted", note: "Confirmed" },
    });
    expect(mockPrisma.foodOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "accepted",
        statusHistory: { create: expect.objectContaining({ oldStatus: "submitted", newStatus: "accepted" }) },
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "food_order.accepted" }));
  });

  it("minimum notice validation works", async () => {
    await expect(createFoodOrder({
      session: householdSession(),
      input: { menuItemId: "menu-item-1", quantity: 2, fulfillmentType: "pickup", requestedDate: new Date() },
    })).rejects.toThrow("hours notice");
  });
});
