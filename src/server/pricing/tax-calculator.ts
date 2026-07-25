import { PaymentModule, TaxCalculationMode, TaxConfigurationStatus, type PricingModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/server/pricing/pricing-types";

export async function calculateTaxAmount(params: {
  module: PricingModule;
  countryCode: string;
  region?: string | null;
  currencyCode: string;
  taxableAmount: number;
}) {
  const configuration = await prisma.taxConfiguration.findFirst({
    where: {
      status: TaxConfigurationStatus.active,
      AND: [
        { OR: [{ countryCode: params.countryCode }, { countryCode: null }] },
        { OR: [{ currencyCode: params.currencyCode }, { currencyCode: null }] },
        { OR: [{ module: paymentModuleFromPricingModule(params.module) }, { module: null }] },
        { OR: [{ region: params.region ?? undefined }, { region: null }] },
      ],
    },
    orderBy: [{ region: "desc" }, { module: "desc" }, { createdAt: "desc" }],
  });
  if (!configuration || configuration.mode === TaxCalculationMode.disabled) {
    return { amount: 0, warning: "No active tax configuration matched this quote. Tax is $0 until Platform Owner configures it." };
  }
  if (configuration.mode === TaxCalculationMode.flat_percent) {
    return { amount: roundMoney(params.taxableAmount * (Number(configuration.taxPercent ?? 0) / 100)), warning: null };
  }
  if (configuration.fixedTaxAmount != null) return { amount: roundMoney(Number(configuration.fixedTaxAmount)), warning: null };
  return { amount: 0, warning: "Tax configuration is manual and did not provide an amount for this quote." };
}

export function paymentModuleFromPricingModule(module: PricingModule) {
  if (module === "food_order") return PaymentModule.food_order;
  if (module === "home_chef_request") return PaymentModule.home_chef_request;
  if (module === "subscription") return PaymentModule.subscription;
  if (module === "manual_invoice") return PaymentModule.manual_invoice;
  return PaymentModule.food_order;
}
