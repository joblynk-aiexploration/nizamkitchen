import type {
  CheckoutQuoteLineType,
  FeeCalculationType,
  FeeType,
  PricingFulfillmentType,
  PricingModule,
  PricingSellerType,
} from "@prisma/client";

export type CheckoutQuoteItemInput = {
  id?: string;
  name: string;
  quantity: number;
  unitAmount: number;
  metadata?: Record<string, unknown>;
};

export type CheckoutPricingInput = {
  module: PricingModule;
  moduleEntityId?: string | null;
  customerUserId: string;
  customerOrganizationId?: string | null;
  sellerOrganizationId?: string | null;
  chefProfileId?: string | null;
  countryCode: string;
  region?: string | null;
  city?: string | null;
  currencyCode: string;
  items: CheckoutQuoteItemInput[];
  fulfillmentType: PricingFulfillmentType;
  sellerType?: PricingSellerType | null;
  deliveryAddress?: Record<string, unknown> | null;
  pickupLocation?: Record<string, unknown> | null;
  requestedDate?: Date | string | null;
  userSubscriptionPlan?: {
    id?: string;
    slug?: string;
    benefitsJson?: Record<string, unknown> | null;
  } | null;
  promoCode?: string | null;
  tipAmount?: number | null;
  tipPercent?: number | null;
  paymentMethod?: string | null;
  quoteTtlMinutes?: number | null;
};

export type PricingRuleSnapshot = {
  policyId: string;
  policyName: string;
  ruleId: string;
  feeType: FeeType;
  calculationType: FeeCalculationType;
  displayName: string;
  amount: number;
};

export type CheckoutQuoteLineOutput = {
  lineType: CheckoutQuoteLineType;
  label: string;
  description?: string | null;
  amount: number;
  currencyCode: string;
  sortOrder: number;
  metadata?: Record<string, unknown>;
};

export type CheckoutQuoteOutput = {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  smallOrderFee: number;
  taxAmount: number;
  regulatoryFee: number;
  discountAmount: number;
  tipAmount: number;
  platformCommissionAmount: number;
  sellerAmount: number;
  totalAmount: number;
  currencyCode: string;
  lineItems: CheckoutQuoteLineOutput[];
  warnings: string[];
  quoteExpiresAt: Date;
  pricingPolicyVersion: string;
  policySnapshot: PricingRuleSnapshot[];
  inputSnapshot: CheckoutPricingInput;
};

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clampMoney(value: number, min?: number | null, max?: number | null) {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return roundMoney(Math.max(0, next));
}
