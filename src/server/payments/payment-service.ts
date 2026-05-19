import { PaymentGatewayStatus, PaymentProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paymentOrderCreateSchema } from "@/lib/validation/payments";
import { createAuditEvent } from "@/server/audit";
import { calculatePaymentBreakdown } from "@/server/payments/currency";
import { PaymentGatewayUnavailableError } from "@/server/payments/payment-errors";

export async function createPaymentOrderForModule(input: unknown) {
  const parsed = paymentOrderCreateSchema.parse(input);
  const existing = await prisma.paymentOrder.findUnique({ where: { idempotencyKey: parsed.idempotencyKey } });
  if (existing) return existing;

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

  const configuration = await prisma.paymentConfiguration.findUnique({
    where: { countryCode_currencyCode: { countryCode: parsed.countryCode, currencyCode: parsed.currencyCode } },
  });
  const breakdown = calculatePaymentBreakdown({
    amount: parsed.amount,
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
      amount: new Prisma.Decimal(parsed.amount),
      currencyCode: parsed.currencyCode,
      platformFeeAmount: new Prisma.Decimal(breakdown.platformFeeAmount),
      sellerAmount: new Prisma.Decimal(breakdown.sellerAmount),
      taxAmount: new Prisma.Decimal(breakdown.taxAmount),
      idempotencyKey: parsed.idempotencyKey,
      returnUrl: parsed.returnUrl ?? null,
      cancelUrl: parsed.cancelUrl ?? null,
      metadataJson: parsed.metadataJson ? (parsed.metadataJson as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

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
      amount: parsed.amount,
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
