import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateCommission } from "@/server/pricing/commission-calculator";
import { calculateDeliveryFee } from "@/server/pricing/delivery-fee-calculator";
import { getActivePricingRules } from "@/server/pricing/fee-policy-service";
import { calculatePromotionDiscount } from "@/server/pricing/promotion-calculator";
import {
  type CheckoutPricingInput,
  type CheckoutQuoteLineOutput,
  type CheckoutQuoteOutput,
  type PricingRuleSnapshot,
  roundMoney,
} from "@/server/pricing/pricing-types";
import { calculateServiceFee } from "@/server/pricing/service-fee-calculator";
import { calculateSmallOrderFee } from "@/server/pricing/small-order-fee-calculator";
import { calculateTaxAmount } from "@/server/pricing/tax-calculator";
import { calculateTip } from "@/server/pricing/tip-calculator";

const PRICING_POLICY_VERSION = "checkout-pricing-v1";

export async function calculateCheckoutQuote(input: CheckoutPricingInput): Promise<CheckoutQuoteOutput> {
  const normalized = normalizeInput(input);
  const warnings: string[] = [];
  const subtotal = roundMoney(
    normalized.items.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0),
  );
  const policies = await getActivePricingRules({
    module: normalized.module,
    countryCode: normalized.countryCode,
    region: normalized.region,
    city: normalized.city,
    sellerType: normalized.sellerType,
    fulfillmentType: normalized.fulfillmentType,
  });
  const rules = policies.flatMap((policy) => policy.rules);
  const serviceFeeResult = calculateServiceFee(subtotal, rules);
  const deliveryFeeResult = calculateDeliveryFee({
    fulfillmentType: normalized.fulfillmentType,
    subtotal,
    rules,
  });
  const smallOrderFeeResult = calculateSmallOrderFee(subtotal, rules);
  if (deliveryFeeResult.warning) warnings.push(deliveryFeeResult.warning);
  if (smallOrderFeeResult.warning) warnings.push(smallOrderFeeResult.warning);

  let serviceFee = serviceFeeResult.amount;
  let deliveryFee = deliveryFeeResult.amount;
  let smallOrderFee = smallOrderFeeResult.amount;
  const benefitWarnings = applySubscriptionBenefits(normalized, {
    subtotal,
    serviceFee,
    deliveryFee,
    smallOrderFee,
  });
  serviceFee = benefitWarnings.serviceFee;
  deliveryFee = benefitWarnings.deliveryFee;
  smallOrderFee = benefitWarnings.smallOrderFee;
  warnings.push(...benefitWarnings.warnings);

  const tipAmount = calculateTip(subtotal, normalized.tipAmount, normalized.tipPercent);
  const taxableBase = roundMoney(subtotal + serviceFee + deliveryFee + smallOrderFee);
  const tax = await calculateTaxAmount({
    module: normalized.module,
    countryCode: normalized.countryCode,
    region: normalized.region,
    currencyCode: normalized.currencyCode,
    taxableAmount: taxableBase,
  });
  if (tax.warning) warnings.push(tax.warning);

  const beforeDiscountTotal = roundMoney(taxableBase + tax.amount + tipAmount);
  const promotion = await calculatePromotionDiscount({
    promoCode: normalized.promoCode,
    module: normalized.module,
    userId: normalized.customerUserId,
    organizationId: normalized.customerOrganizationId,
    sellerOrganizationId: normalized.sellerOrganizationId,
    countryCode: normalized.countryCode,
    amount: beforeDiscountTotal,
    currencyCode: normalized.currencyCode,
  });
  const totalAmount = roundMoney(Math.max(0, beforeDiscountTotal - promotion.discountAmount));

  const paymentConfiguration = await prisma.paymentConfiguration.findUnique({
    where: {
      countryCode_currencyCode: {
        countryCode: normalized.countryCode,
        currencyCode: normalized.currencyCode,
      },
    },
  });
  const commission = calculateCommission({
    sellerGross: subtotal + tipAmount,
    rules,
    fallbackCommissionPercent: paymentConfiguration?.platformCommissionPercent == null ? null : Number(paymentConfiguration.platformCommissionPercent),
    fallbackFixedAmount: paymentConfiguration?.fixedCommissionAmount == null ? null : Number(paymentConfiguration.fixedCommissionAmount),
  });
  const platformCommissionAmount = commission.amount;
  const sellerAmount = roundMoney(Math.max(0, subtotal + tipAmount - platformCommissionAmount));

  const policySnapshot = buildPolicySnapshot(policies, [
    { ruleId: serviceFeeResult.rule?.id, amount: serviceFee },
    { ruleId: deliveryFeeResult.rule?.id, amount: deliveryFee },
    { ruleId: smallOrderFeeResult.rule?.id, amount: smallOrderFee },
    { ruleId: commission.rule?.id, amount: platformCommissionAmount },
  ]);
  const lineItems = buildLineItems({
    currencyCode: normalized.currencyCode,
    subtotal,
    serviceFee,
    deliveryFee,
    smallOrderFee,
    taxAmount: tax.amount,
    discountAmount: promotion.discountAmount,
    tipAmount,
    platformCommissionAmount,
    sellerAmount,
    totalAmount,
  });

  return {
    subtotal,
    serviceFee,
    deliveryFee,
    smallOrderFee,
    taxAmount: tax.amount,
    regulatoryFee: 0,
    discountAmount: promotion.discountAmount,
    tipAmount,
    platformCommissionAmount,
    sellerAmount,
    totalAmount,
    currencyCode: normalized.currencyCode,
    lineItems,
    warnings,
    quoteExpiresAt: new Date(Date.now() + (normalized.quoteTtlMinutes ?? 15) * 60 * 1000),
    pricingPolicyVersion: PRICING_POLICY_VERSION,
    policySnapshot,
    inputSnapshot: normalized,
  };
}

function normalizeInput(input: CheckoutPricingInput): CheckoutPricingInput {
  const items = input.items.map((item) => ({
    ...item,
    quantity: Math.max(0, Number(item.quantity)),
    unitAmount: roundMoney(Number(item.unitAmount)),
  }));
  return {
    ...input,
    countryCode: input.countryCode.toUpperCase(),
    currencyCode: input.currencyCode.toUpperCase(),
    items,
  };
}

function applySubscriptionBenefits(
  input: CheckoutPricingInput,
  fees: { subtotal: number; serviceFee: number; deliveryFee: number; smallOrderFee: number },
) {
  const benefits = input.userSubscriptionPlan?.benefitsJson ?? {};
  const warnings: string[] = [];
  let serviceFee = fees.serviceFee;
  let deliveryFee = fees.deliveryFee;
  let smallOrderFee = fees.smallOrderFee;
  const freeDeliveryThreshold = numberBenefit(benefits, "freeDeliveryThreshold");
  if (freeDeliveryThreshold != null && fees.subtotal >= freeDeliveryThreshold && deliveryFee > 0) {
    deliveryFee = 0;
    warnings.push("Subscription benefit waived the delivery fee.");
  }
  const serviceFeeDiscountPercent = numberBenefit(benefits, "serviceFeeDiscountPercent");
  if (serviceFeeDiscountPercent != null && serviceFee > 0) {
    serviceFee = roundMoney(serviceFee * Math.max(0, 1 - serviceFeeDiscountPercent / 100));
    warnings.push("Subscription benefit reduced the service fee.");
  }
  if (benefits.waiveSmallOrderFee === true && smallOrderFee > 0) {
    smallOrderFee = 0;
    warnings.push("Subscription benefit waived the small order fee.");
  }
  return { serviceFee, deliveryFee, smallOrderFee, warnings };
}

function numberBenefit(benefits: Record<string, unknown>, key: string) {
  const value = Number(benefits[key]);
  return Number.isFinite(value) ? value : null;
}

function buildPolicySnapshot(
  policies: Awaited<ReturnType<typeof getActivePricingRules>>,
  applied: Array<{ ruleId?: string; amount: number }>,
): PricingRuleSnapshot[] {
  const appliedMap = new Map(applied.filter((item) => item.ruleId).map((item) => [item.ruleId, item.amount]));
  return policies.flatMap((policy) =>
    policy.rules
      .filter((rule) => appliedMap.has(rule.id))
      .map((rule) => ({
        policyId: policy.id,
        policyName: policy.name,
        ruleId: rule.id,
        feeType: rule.feeType,
        calculationType: rule.calculationType,
        displayName: rule.displayName,
        amount: appliedMap.get(rule.id) ?? 0,
      })),
  );
}

function buildLineItems(values: {
  currencyCode: string;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  smallOrderFee: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  platformCommissionAmount: number;
  sellerAmount: number;
  totalAmount: number;
}): CheckoutQuoteLineOutput[] {
  const line = (
    lineType: CheckoutQuoteLineOutput["lineType"],
    label: string,
    amount: number,
    sortOrder: number,
    metadata?: Record<string, unknown>,
  ): CheckoutQuoteLineOutput => ({
    lineType,
    label,
    amount: roundMoney(amount),
    currencyCode: values.currencyCode,
    sortOrder,
    metadata,
  });
  return [
    line("subtotal", "Items subtotal", values.subtotal, 10),
    line("fee", "Service fee", values.serviceFee, 20),
    line("fee", "Delivery fee", values.deliveryFee, 30),
    line("fee", "Small order fee", values.smallOrderFee, 40),
    line("tax", "Taxes/local fees", values.taxAmount, 50),
    line("discount", "Discounts and credits", -values.discountAmount, 60),
    line("tip", "Tip", values.tipAmount, 70),
    line("commission", "Platform commission", values.platformCommissionAmount, 900, { internal: true }),
    line("payout", "Seller payout estimate", values.sellerAmount, 910, { internal: true }),
    line("total", "Total", values.totalAmount, 1000),
  ];
}

export function quoteJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
