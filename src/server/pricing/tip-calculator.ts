import { roundMoney } from "@/server/pricing/pricing-types";

export function calculateTip(subtotal: number, tipAmount?: number | null, tipPercent?: number | null) {
  if (tipAmount != null && tipAmount > 0) return roundMoney(tipAmount);
  if (tipPercent != null && tipPercent > 0) return roundMoney(subtotal * (tipPercent / 100));
  return 0;
}

export const DEFAULT_TIP_SUGGESTIONS = [10, 15, 18, 20];
