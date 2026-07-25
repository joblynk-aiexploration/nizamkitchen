import {
  FoodOrderFulfillmentType,
  FoodOrderSellerType,
  PricingFulfillmentType,
  PricingModule,
  PricingSellerType,
  type PlatformRole,
  type BillingPlan,
  type FoodOrder,
  type FoodOrderItem,
  type HomeChefRequest,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { acceptCheckoutQuote, createCheckoutQuoteSnapshot } from "@/server/pricing/quote-snapshot-service";
import type { CheckoutPricingInput } from "@/server/pricing/pricing-types";

type QuoteWorkflowSession = {
  user: { id: string; platformRole?: PlatformRole | null };
  activeOrganization?: { id: string; countryCode: string } | null;
};

export async function createAcceptedFoodOrderQuote(params: {
  order: FoodOrder & { items?: FoodOrderItem[] };
  userId: string;
}) {
  const input = foodOrderQuoteInput(params.order, params.userId);
  const session = quoteSession(params.userId, params.order.customerOrganizationId, params.order.countryCode);
  const quote = await createCheckoutQuoteSnapshot(session, input);
  await acceptCheckoutQuote(session, quote.id);
  return quote;
}

export async function createAcceptedHomeChefQuote(params: {
  request: HomeChefRequest;
  userId: string;
  paymentType: "deposit" | "full";
  promotionCode?: string | null;
}) {
  const input = homeChefQuoteInput(params.request, params.userId, params.paymentType, params.promotionCode);
  const session = quoteSession(params.userId, params.request.organizationId, params.request.countryCode);
  const quote = await createCheckoutQuoteSnapshot(session, input);
  await acceptCheckoutQuote(session, quote.id);
  return quote;
}

export async function createAcceptedSubscriptionQuote(params: {
  plan: BillingPlan;
  subscriptionId: string;
  organizationId: string;
  userId: string;
  countryCode: string;
  promotionCode?: string | null;
}) {
  const input: CheckoutPricingInput = {
    module: PricingModule.subscription,
    moduleEntityId: params.subscriptionId,
    customerUserId: params.userId,
    customerOrganizationId: params.organizationId,
    countryCode: params.countryCode,
    currencyCode: params.plan.currencyCode,
    fulfillmentType: PricingFulfillmentType.digital_subscription,
    sellerType: PricingSellerType.platform,
    promoCode: params.promotionCode ?? null,
    items: [
      {
        id: params.plan.id,
        name: params.plan.name,
        quantity: 1,
        unitAmount: Number(params.plan.priceAmount),
        metadata: { planId: params.plan.id, interval: params.plan.billingInterval },
      },
    ],
  };
  const session = quoteSession(params.userId, params.organizationId, params.countryCode);
  const quote = await createCheckoutQuoteSnapshot(session, input);
  await acceptCheckoutQuote(session, quote.id);
  return quote;
}

export async function previewFoodOrderQuote(order: FoodOrder & { items?: FoodOrderItem[] }) {
  const input = foodOrderQuoteInput(order, order.customerUserId);
  const { calculateCheckoutQuote } = await import("@/server/pricing/pricing-engine");
  return calculateCheckoutQuote(input);
}

export async function previewHomeChefQuote(
  request: HomeChefRequest,
  paymentType: "deposit" | "full",
  promotionCode?: string | null,
) {
  const input = homeChefQuoteInput(request, request.createdById, paymentType, promotionCode);
  const { calculateCheckoutQuote } = await import("@/server/pricing/pricing-engine");
  return calculateCheckoutQuote(input);
}

export async function getCheckoutQuoteLinesForPaymentOrder(paymentOrderId: string) {
  const paymentOrder = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    select: { checkoutQuoteId: true },
  });
  if (!paymentOrder?.checkoutQuoteId) return [];
  const quote = await prisma.checkoutQuote.findUnique({
    where: { id: paymentOrder.checkoutQuoteId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  return quote?.lines ?? [];
}

export async function listCheckoutQuoteLinesByPaymentOrderIds(paymentOrderIds: string[]) {
  const orders = paymentOrderIds.length
    ? await prisma.paymentOrder.findMany({
        where: { id: { in: paymentOrderIds }, checkoutQuoteId: { not: null } },
        select: { id: true, checkoutQuoteId: true },
      })
    : [];
  const quoteIds = orders.map((order) => order.checkoutQuoteId).filter((id): id is string => Boolean(id));
  const quotes = quoteIds.length
    ? await prisma.checkoutQuote.findMany({
        where: { id: { in: quoteIds } },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      })
    : [];
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  return new Map(orders.map((order) => [order.id, quoteById.get(order.checkoutQuoteId!)?.lines ?? []]));
}

function foodOrderQuoteInput(order: FoodOrder & { items?: FoodOrderItem[] }, userId: string): CheckoutPricingInput {
  return {
    module: PricingModule.food_order,
    moduleEntityId: order.id,
    customerUserId: userId,
    customerOrganizationId: order.customerOrganizationId,
    sellerOrganizationId: order.sellerOrganizationId,
    countryCode: order.countryCode,
    currencyCode: order.currencyCode,
    region: order.deliveryRegion ?? null,
    city: order.deliveryCity ?? null,
    fulfillmentType: pricingFulfillmentFromFoodOrder(order.fulfillmentType),
    sellerType: pricingSellerFromFoodOrder(order.sellerType),
    promoCode: order.promotionCode ?? null,
    deliveryAddress: order.deliveryAddressLine1
      ? {
          addressLine1: order.deliveryAddressLine1,
          addressLine2: order.deliveryAddressLine2,
          city: order.deliveryCity,
          region: order.deliveryRegion,
          postalCode: order.deliveryPostalCode,
          countryCode: order.deliveryCountryCode,
        }
      : null,
    requestedDate: order.requestedDate,
    items: order.items?.length
      ? order.items.map((item) => ({
          id: item.menuItemId,
          name: item.nameSnapshot,
          quantity: item.quantity,
          unitAmount: Number(item.unitPriceAmount ?? 0),
          metadata: { foodOrderItemId: item.id },
        }))
      : [{ name: "Food order", quantity: 1, unitAmount: Number(order.subtotalAmount ?? 0) }],
  };
}

function homeChefQuoteInput(
  request: HomeChefRequest,
  userId: string,
  paymentType: "deposit" | "full",
  promotionCode?: string | null,
): CheckoutPricingInput {
  const amount = paymentType === "deposit" ? request.depositAmount : request.quotedAmount;
  if (!amount || amount <= 0) throw new Error("This home chef request does not have a payable quote yet.");
  return {
    module: PricingModule.home_chef_request,
    moduleEntityId: request.id,
    customerUserId: userId,
    customerOrganizationId: request.organizationId,
    sellerOrganizationId: request.assignedChefOrganizationId ?? null,
    chefProfileId: request.assignedChefProfileId ?? null,
    countryCode: request.countryCode,
    currencyCode: request.currencyCode,
    region: request.region ?? null,
    city: request.city ?? null,
    fulfillmentType: PricingFulfillmentType.home_service,
    sellerType: PricingSellerType.chef_staff,
    promoCode: promotionCode ?? request.promotionCode ?? null,
    deliveryAddress: request.serviceAddressLine1
      ? {
          addressLine1: request.serviceAddressLine1,
          addressLine2: request.serviceAddressLine2,
          city: request.city,
          region: request.region,
          postalCode: request.postalCode,
        }
      : null,
    requestedDate: request.requestedDate,
    items: [
      {
        id: request.id,
        name: paymentType === "deposit" ? "Home chef deposit" : "Home chef service quote",
        quantity: 1,
        unitAmount: Number(amount),
        metadata: { paymentType },
      },
    ],
  };
}

function pricingFulfillmentFromFoodOrder(value: FoodOrderFulfillmentType) {
  if (value === FoodOrderFulfillmentType.delivery) return PricingFulfillmentType.delivery;
  if (value === FoodOrderFulfillmentType.pickup) return PricingFulfillmentType.pickup;
  return PricingFulfillmentType.preorder;
}

function pricingSellerFromFoodOrder(value: FoodOrderSellerType) {
  if (value === FoodOrderSellerType.restaurant) return PricingSellerType.restaurant;
  return PricingSellerType.home_catering;
}

function quoteSession(userId: string, organizationId: string, countryCode: string): QuoteWorkflowSession {
  return {
    user: { id: userId },
    activeOrganization: { id: organizationId, countryCode },
  };
}
