import type { FeeRule } from "@prisma/client";
import { calculateFixedOrPercentageFee } from "@/server/pricing/service-fee-calculator";
import { roundMoney } from "@/server/pricing/pricing-types";

export function calculateCommission(params: {
  sellerGross: number;
  rules: FeeRule[];
  fallbackCommissionPercent?: number | null;
  fallbackFixedAmount?: number | null;
}) {
  const rule = params.rules.find((item) => item.isActive && item.feeType === "platform_commission");
  if (rule) return { amount: calculateFixedOrPercentageFee(params.sellerGross, rule), rule };
  const percent = params.fallbackCommissionPercent ?? null;
  const fixed = params.fallbackFixedAmount ?? null;
  if (percent != null) return { amount: roundMoney(params.sellerGross * (percent / 100)), rule: null };
  if (fixed != null) return { amount: roundMoney(fixed), rule: null };
  return { amount: 0, rule: null };
}
