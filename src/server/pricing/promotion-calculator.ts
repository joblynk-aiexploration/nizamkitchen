import type { PricingModule } from "@prisma/client";
import { applyPromotionToAmount } from "@/server/promotions";

export async function calculatePromotionDiscount(params: {
  promoCode?: string | null;
  module: PricingModule;
  userId: string;
  organizationId?: string | null;
  sellerOrganizationId?: string | null;
  countryCode: string;
  amount: number;
  currencyCode: string;
}) {
  const promotionModule = promotionModuleFromPricingModule(params.module);
  if (!promotionModule || !params.promoCode) return { discountAmount: 0, payableAmount: params.amount, warning: null };
  const result = await applyPromotionToAmount({
    code: params.promoCode,
    module: promotionModule,
    userId: params.userId,
    organizationId: params.organizationId ?? null,
    sellerOrganizationId: params.sellerOrganizationId ?? null,
    countryCode: params.countryCode,
    amount: params.amount,
    currencyCode: params.currencyCode,
  });
  return { discountAmount: result.discountAmount, payableAmount: result.payableAmount, warning: null };
}

function promotionModuleFromPricingModule(module: PricingModule) {
  if (module === "food_order") return "food_order";
  if (module === "home_chef_request") return "home_chef_request";
  if (module === "subscription") return "subscription";
  return null;
}
