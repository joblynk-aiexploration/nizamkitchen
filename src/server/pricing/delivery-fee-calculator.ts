import type { FeeRule, FulfillmentDeliveryZone, PricingFulfillmentType } from "@prisma/client";
import { roundMoney } from "@/server/pricing/pricing-types";

export function calculateDeliveryFee(params: {
  fulfillmentType: PricingFulfillmentType;
  subtotal: number;
  rules: FeeRule[];
  deliveryZone?: Pick<FulfillmentDeliveryZone, "deliveryFeeAmount" | "freeDeliveryAt"> | null;
}) {
  if (params.fulfillmentType !== "delivery") return { amount: 0, rule: null, warning: null };
  if (params.deliveryZone) {
    const freeAt = params.deliveryZone.freeDeliveryAt;
    if (freeAt != null && params.subtotal >= freeAt) return { amount: 0, rule: null, warning: null };
    return { amount: roundMoney(params.deliveryZone.deliveryFeeAmount), rule: null, warning: null };
  }
  const rule = params.rules.find((item) => item.isActive && item.feeType === "delivery_fee");
  if (!rule) return { amount: 0, rule: null, warning: "No delivery fee policy is active. Delivery fee is currently $0 until Platform Owner configures it." };
  return { amount: roundMoney(Number(rule.fixedAmount ?? 0)), rule, warning: null };
}
