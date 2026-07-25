import { CheckoutQuoteStatus, Prisma, type PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { calculateCheckoutQuote, quoteJson } from "@/server/pricing/pricing-engine";
import type { CheckoutPricingInput } from "@/server/pricing/pricing-types";

type QuoteSession = {
  user: { id: string; platformRole?: PlatformRole | null };
  activeOrganization?: { id: string; countryCode: string } | null;
};

export async function createCheckoutQuoteSnapshot(session: QuoteSession, input: CheckoutPricingInput) {
  const quote = await calculateCheckoutQuote(input);
  const organizationId = input.customerOrganizationId ?? session.activeOrganization?.id;
  if (!organizationId) throw new Error("A customer organization is required to create a checkout quote.");

  const record = await prisma.checkoutQuote.create({
    data: {
      organizationId,
      customerUserId: input.customerUserId,
      customerOrganizationId: input.customerOrganizationId ?? null,
      sellerOrganizationId: input.sellerOrganizationId ?? null,
      chefProfileId: input.chefProfileId ?? null,
      module: input.module,
      moduleEntityId: input.moduleEntityId ?? null,
      status: CheckoutQuoteStatus.active,
      countryCode: input.countryCode,
      region: input.region ?? null,
      city: input.city ?? null,
      currencyCode: input.currencyCode,
      subtotalAmount: new Prisma.Decimal(quote.subtotal),
      serviceFeeAmount: new Prisma.Decimal(quote.serviceFee),
      deliveryFeeAmount: new Prisma.Decimal(quote.deliveryFee),
      smallOrderFeeAmount: new Prisma.Decimal(quote.smallOrderFee),
      taxAmount: new Prisma.Decimal(quote.taxAmount),
      regulatoryFeeAmount: new Prisma.Decimal(quote.regulatoryFee),
      discountAmount: new Prisma.Decimal(quote.discountAmount),
      tipAmount: new Prisma.Decimal(quote.tipAmount),
      platformCommissionAmount: new Prisma.Decimal(quote.platformCommissionAmount),
      sellerAmount: new Prisma.Decimal(quote.sellerAmount),
      totalAmount: new Prisma.Decimal(quote.totalAmount),
      pricingPolicySnapshotJson: quoteJson({ version: quote.pricingPolicyVersion, policies: quote.policySnapshot, warnings: quote.warnings }),
      inputSnapshotJson: quoteJson(quote.inputSnapshot),
      expiresAt: quote.quoteExpiresAt,
      lines: {
        create: quote.lineItems.map((line) => ({
          lineType: line.lineType,
          label: line.label,
          description: line.description ?? null,
          amount: new Prisma.Decimal(line.amount),
          currencyCode: line.currencyCode,
          sortOrder: line.sortOrder,
          metadataJson: line.metadata ? quoteJson(line.metadata) : Prisma.JsonNull,
        })),
      },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId,
    countryCode: input.countryCode,
    action: "checkout_quote.created",
    targetType: "checkout_quote",
    targetId: record.id,
    details: { module: input.module, totalAmount: quote.totalAmount, currencyCode: quote.currencyCode },
  });
  return record;
}

export async function acceptCheckoutQuote(session: QuoteSession, quoteId: string) {
  const quote = await prisma.checkoutQuote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new Error("Checkout quote not found.");
  if (quote.customerUserId !== session.user.id && session.user.platformRole !== "platform_owner") {
    throw new Error("This checkout quote belongs to another user.");
  }
  if (quote.expiresAt <= new Date()) {
    await prisma.checkoutQuote.update({ where: { id: quoteId }, data: { status: CheckoutQuoteStatus.expired } });
    throw new Error("This checkout quote has expired. Please refresh the checkout total.");
  }
  const accepted = await prisma.checkoutQuote.update({
    where: { id: quoteId },
    data: { status: CheckoutQuoteStatus.accepted, acceptedAt: new Date() },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: quote.organizationId,
    countryCode: quote.countryCode,
    action: "checkout_quote.accepted",
    targetType: "checkout_quote",
    targetId: quote.id,
    details: { module: quote.module, totalAmount: Number(quote.totalAmount) },
  });
  return accepted;
}

export async function listCheckoutQuotes() {
  return prisma.checkoutQuote.findMany({
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getCheckoutQuote(id: string) {
  return prisma.checkoutQuote.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}
