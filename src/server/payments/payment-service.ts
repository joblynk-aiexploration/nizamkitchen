import { CheckoutQuoteStatus, OrganizationType, PaymentGatewayStatus, PaymentModule, PaymentProvider, Prisma, SellerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paymentOrderCreateSchema } from "@/lib/validation/payments";
import { createAuditEvent } from "@/server/audit";
import { calculatePaymentBreakdown } from "@/server/payments/currency";
import { PaymentGatewayUnavailableError } from "@/server/payments/payment-errors";
import { applyPromotionToAmount, normalizePromotionCode, redeemPromotion } from "@/server/promotions";
import { assertSellerGate } from "@/server/seller-verification-gates";

export async function createPaymentOrderForModule(input: unknown) {
  const parsed = paymentOrderCreateSchema.parse(input);
  const existing = await prisma.paymentOrder.findUnique({ where: { idempotencyKey: parsed.idempotencyKey } });
  if (existing) return existing;
  const checkoutQuote = parsed.checkoutQuoteId
    ? await prisma.checkoutQuote.findUnique({ where: { id: parsed.checkoutQuoteId } })
    : null;
  if (parsed.checkoutQuoteId && !checkoutQuote) throw new Error("Checkout quote not found.");
  if (checkoutQuote) {
    if (checkoutQuote.status !== CheckoutQuoteStatus.active && checkoutQuote.status !== CheckoutQuoteStatus.accepted) {
      throw new Error("Checkout quote is not payable.");
    }
    if (checkoutQuote.expiresAt <= new Date()) {
      await prisma.checkoutQuote.update({ where: { id: checkoutQuote.id }, data: { status: CheckoutQuoteStatus.expired } });
      throw new Error("Checkout quote has expired. Please refresh checkout.");
    }
    if (checkoutQuote.customerUserId && parsed.customerUserId && checkoutQuote.customerUserId !== parsed.customerUserId) {
      throw new Error("Checkout quote belongs to another user.");
    }
    if (checkoutQuote.customerOrganizationId && parsed.customerOrganizationId && checkoutQuote.customerOrganizationId !== parsed.customerOrganizationId) {
      throw new Error("Checkout quote belongs to another organization.");
    }
  }
  const trustedAmount = checkoutQuote ? Number(checkoutQuote.totalAmount) : parsed.amount;

  if (parsed.gatewayId) {
    const gateway = await prisma.paymentGateway.findUnique({ where: { id: parsed.gatewayId } });
    if (!gateway || gateway.status !== PaymentGatewayStatus.active) {
      throw new PaymentGatewayUnavailableError("Disabled or missing payment gateways cannot be used.");
    }
    const supportedCountries = parseStringArray(gateway.supportedCountriesJson);
    const supportedCurrencies = parseStringArray(gateway.supportedCurrenciesJson);
    if (supportedCountries.length && !supportedCountries.includes(parsed.countryCode)) {
      throw new PaymentGatewayUnavailableError("This gateway is not enabled for the selected country.");
    }
    if (supportedCurrencies.length && !supportedCurrencies.includes(parsed.currencyCode)) {
      throw new PaymentGatewayUnavailableError("This gateway is not enabled for the selected currency.");
    }
  }
  if (parsed.sellerOrganizationId && providerRequiresHostedCheckout(parsed.provider)) {
    const seller = await prisma.organization.findUnique({
      where: { id: parsed.sellerOrganizationId },
      select: { id: true, organizationType: true, countryCode: true },
    });
    const sellerType = sellerTypeFromOrganizationType(seller?.organizationType ?? null);
    if (seller && sellerType) {
      await assertSellerGate({
        organizationId: seller.id,
        sellerType,
        countryCode: seller.countryCode,
        capability: "payouts",
        message: "Seller payout verification is incomplete. Live checkout is not available yet.",
      });
    }
  }

  const promotionModule = promotionModuleFromPaymentModule(parsed.module);
  const quotePromotionCode = checkoutQuote
    ? promotionCodeFromQuote(parsed.promotionCode, checkoutQuote.inputSnapshotJson)
    : null;
  const promotion = promotionModule && (!checkoutQuote || quotePromotionCode)
    ? await applyPromotionToAmount({
        code: checkoutQuote ? quotePromotionCode : parsed.promotionCode,
        module: promotionModule,
        userId: parsed.customerUserId ?? null,
        organizationId: parsed.customerOrganizationId ?? parsed.organizationId,
        sellerOrganizationId: parsed.sellerOrganizationId ?? null,
        countryCode: parsed.countryCode,
        amount: checkoutQuote ? Number(checkoutQuote.totalAmount) + Number(checkoutQuote.discountAmount) : trustedAmount,
        currencyCode: parsed.currencyCode,
      })
    : { evaluation: null, payableAmount: trustedAmount, discountAmount: checkoutQuote ? Number(checkoutQuote.discountAmount) : 0 };
  const payableAmount = checkoutQuote ? trustedAmount : promotion.payableAmount;
  const discountAmount = checkoutQuote ? Number(checkoutQuote.discountAmount) : promotion.discountAmount;
  if (payableAmount <= 0 && providerRequiresHostedCheckout(parsed.provider)) {
    throw new PaymentGatewayUnavailableError("This checkout total is zero after discounts. Hosted payment checkout is not required.");
  }

  const configuration = await prisma.paymentConfiguration.findUnique({
    where: { countryCode_currencyCode: { countryCode: parsed.countryCode, currencyCode: parsed.currencyCode } },
  });
  const breakdown = calculatePaymentBreakdown({
    amount: payableAmount,
    platformCommissionPercent: configuration?.platformCommissionPercent ? Number(configuration.platformCommissionPercent) : null,
    fixedCommissionAmount: configuration?.fixedCommissionAmount ? Number(configuration.fixedCommissionAmount) : null,
    taxPercent: configuration?.taxPercent ? Number(configuration.taxPercent) : null,
  });

  const order = await prisma.paymentOrder.create({
    data: {
      organizationId: parsed.organizationId,
      countryCode: parsed.countryCode,
      customerOrganizationId: parsed.customerOrganizationId ?? null,
      customerUserId: parsed.customerUserId ?? null,
      sellerOrganizationId: parsed.sellerOrganizationId ?? null,
      module: parsed.module,
      moduleEntityId: parsed.moduleEntityId,
      provider: parsed.provider,
      gatewayId: parsed.gatewayId ?? null,
      checkoutQuoteId: parsed.checkoutQuoteId ?? null,
      amount: new Prisma.Decimal(payableAmount),
      currencyCode: parsed.currencyCode,
      platformFeeAmount: new Prisma.Decimal(breakdown.platformFeeAmount),
      sellerAmount: new Prisma.Decimal(breakdown.sellerAmount),
      taxAmount: new Prisma.Decimal(breakdown.taxAmount),
      discountAmount: new Prisma.Decimal(discountAmount),
      promotionCode: promotion.evaluation?.promotion.code ?? (quotePromotionCode ? normalizePromotionCode(quotePromotionCode) : null),
      idempotencyKey: parsed.idempotencyKey,
      returnUrl: parsed.returnUrl ?? null,
      cancelUrl: parsed.cancelUrl ?? null,
      metadataJson: parsed.metadataJson ? (parsed.metadataJson as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
  if (promotion.evaluation && promotionModule) {
    const redemption = await redeemPromotion({
      ...promotion.evaluation,
      userId: parsed.customerUserId ?? null,
      organizationId: parsed.customerOrganizationId ?? parsed.organizationId,
      sellerOrganizationId: parsed.sellerOrganizationId ?? null,
      countryCode: parsed.countryCode,
      module: promotionModule,
      moduleEntityId: parsed.moduleEntityId,
      paymentOrderId: order.id,
      currencyCode: parsed.currencyCode,
    });
    await prisma.paymentOrder.update({ where: { id: order.id }, data: { promotionRedemptionId: redemption.id } });
  }
  if (checkoutQuote) {
    await prisma.checkoutQuote.update({
      where: { id: checkoutQuote.id },
      data: { status: CheckoutQuoteStatus.converted_to_payment },
    });
    await createAuditEvent({
      actorUserId: parsed.customerUserId ?? null,
      organizationId: parsed.organizationId,
      countryCode: parsed.countryCode,
      action: "checkout_quote.converted_to_payment",
      targetType: "checkout_quote",
      targetId: checkoutQuote.id,
      details: { paymentOrderId: order.id, amount: payableAmount, currencyCode: parsed.currencyCode },
    });
  }

  await createAuditEvent({
    actorUserId: parsed.customerUserId ?? null,
    organizationId: parsed.organizationId,
    countryCode: parsed.countryCode,
    action: "payment_order.created",
    targetType: "payment_order",
    targetId: order.id,
    details: {
      module: parsed.module,
      moduleEntityId: parsed.moduleEntityId,
      provider: parsed.provider,
      amount: payableAmount,
      originalAmount: trustedAmount,
      discountAmount,
      currencyCode: parsed.currencyCode,
    },
  });

  return order;
}

export function parseStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.toUpperCase()) : [];
}

export function providerRequiresHostedCheckout(provider: PaymentProvider) {
  return provider !== PaymentProvider.manual && provider !== PaymentProvider.cash;
}

function sellerTypeFromOrganizationType(organizationType: OrganizationType | null): SellerType | null {
  if (organizationType === OrganizationType.home_catering) return SellerType.home_catering;
  if (organizationType === OrganizationType.restaurant) return SellerType.restaurant;
  if (organizationType === OrganizationType.chef_business) return SellerType.chef_business;
  return null;
}

function promotionModuleFromPaymentModule(module: PaymentModule) {
  if (module === PaymentModule.food_order) return "food_order";
  if (module === PaymentModule.home_chef_request) return "home_chef_request";
  if (module === PaymentModule.subscription) return "subscription";
  return null;
}

function promotionCodeFromQuote(parsedCode: string | undefined, inputSnapshotJson: Prisma.JsonValue) {
  if (parsedCode?.trim()) return parsedCode;
  if (!inputSnapshotJson || typeof inputSnapshotJson !== "object" || Array.isArray(inputSnapshotJson)) return null;
  const code = (inputSnapshotJson as Record<string, unknown>).promoCode;
  return typeof code === "string" && code.trim() ? code : null;
}
