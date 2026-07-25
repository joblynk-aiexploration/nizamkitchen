import type { FeeRule } from "@prisma/client";
import { roundMoney } from "@/server/pricing/pricing-types";

export function calculateSmallOrderFee(subtotal: number, rules: FeeRule[]) {
  const rule = rules.find((item) => item.isActive && item.feeType === "small_order_fee");
  if (!rule) return { amount: 0, rule: null, warning: null };
  const threshold = Number(rule.thresholdAmount ?? 0);
  if (threshold > 0 && subtotal < threshold) {
    return {
      amount: roundMoney(Number(rule.fixedAmount ?? 0)),
      rule,
      warning: `Add $${roundMoney(threshold - subtotal).toFixed(2)} more to avoid the small order fee.`,
    };
  }
  return { amount: 0, rule, warning: null };
}
