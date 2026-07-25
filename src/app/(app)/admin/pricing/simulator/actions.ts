"use server";

import { PricingFulfillmentType, PricingModule, PricingSellerType } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { calculateCheckoutQuote } from "@/server/pricing";

export async function simulateCheckoutQuoteAction(formData: FormData) {
  await requirePlatformRole(["platform_owner", "platform_admin"]);
  const subtotal = numberField(formData, "subtotal", 25);
  const tipPercent = numberField(formData, "tipPercent", 0);
  await calculateCheckoutQuote({
    module: stringField(formData, "module", "food_order") as PricingModule,
    customerUserId: "pricing-simulator",
    customerOrganizationId: "pricing-simulator",
    sellerOrganizationId: stringField(formData, "sellerOrganizationId") || null,
    chefProfileId: stringField(formData, "chefProfileId") || null,
    countryCode: stringField(formData, "countryCode", "US").toUpperCase(),
    region: stringField(formData, "region") || null,
    city: stringField(formData, "city") || null,
    currencyCode: stringField(formData, "currencyCode", "USD").toUpperCase(),
    items: [{ name: "Simulator subtotal", quantity: 1, unitAmount: subtotal }],
    fulfillmentType: stringField(formData, "fulfillmentType", "delivery") as PricingFulfillmentType,
    sellerType: (stringField(formData, "sellerType") || null) as PricingSellerType | null,
    promoCode: stringField(formData, "promoCode") || null,
    tipPercent,
  });
}

function stringField(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function numberField(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}
