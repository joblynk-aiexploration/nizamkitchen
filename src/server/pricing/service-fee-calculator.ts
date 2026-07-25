import type { FeeRule } from "@prisma/client";
import { clampMoney, roundMoney } from "@/server/pricing/pricing-types";

export function calculateServiceFee(subtotal: number, rules: FeeRule[]) {
  const rule = rules.find((item) => item.isActive && item.feeType === "platform_service_fee");
  if (!rule) return { amount: 0, rule: null };
  const percentage = rule.percentage == null ? null : Number(rule.percentage);
  const fixedAmount = rule.fixedAmount == null ? null : Number(rule.fixedAmount);
  const base = percentage != null ? subtotal * (percentage / 100) : fixedAmount ?? 0;
  return {
    amount: clampMoney(base, rule.minAmount == null ? null : Number(rule.minAmount), rule.maxAmount == null ? null : Number(rule.maxAmount)),
    rule,
  };
}

export function calculateFixedOrPercentageFee(subtotal: number, rule: FeeRule | null | undefined) {
  if (!rule) return 0;
  if (rule.percentage != null) return clampMoney(subtotal * (Number(rule.percentage) / 100), rule.minAmount == null ? null : Number(rule.minAmount), rule.maxAmount == null ? null : Number(rule.maxAmount));
  return roundMoney(Number(rule.fixedAmount ?? 0));
}
