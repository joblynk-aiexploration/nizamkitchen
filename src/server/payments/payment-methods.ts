import { PaymentProvider, type PaymentGateway, type PaymentGatewaySetting, type PaymentModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AvailablePaymentMethod = {
  provider: PaymentProvider;
  label: string;
  enabled: boolean;
  reason?: string;
  walletBackedBy?: PaymentProvider;
};

export async function listAvailablePaymentMethods(params: {
  countryCode: string;
  currencyCode: string;
  module: PaymentModule;
  sellerOrganizationId?: string | null;
  amount?: number | null;
}) {
  const configuration = await prisma.paymentConfiguration.findUnique({
    where: { countryCode_currencyCode: { countryCode: params.countryCode, currencyCode: params.currencyCode } },
  });
  const gateways = await prisma.paymentGateway.findMany({
    where: {
      status: "active",
      OR: [{ countryCode: params.countryCode }, { countryCode: null }],
    },
    include: { settings: true },
    orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
  });
  const stripe = gatewaySupports(gateways, PaymentProvider.stripe, params.countryCode, params.currencyCode);
  const paypal = gatewaySupports(gateways, PaymentProvider.paypal, params.countryCode, params.currencyCode);
  const manualAllowed = configuration?.allowManualPayment ?? true;
  const sellerReady = params.sellerOrganizationId ? await sellerCanReceiveMarketplacePayment(params.sellerOrganizationId) : true;

  return [
    {
      provider: PaymentProvider.stripe,
      label: "Stripe Checkout",
      enabled: Boolean(configuration?.allowStripe && stripe && sellerReady),
      reason: !configuration?.allowStripe ? "Stripe is disabled for this country/currency." : !stripe ? "No active Stripe gateway supports this country/currency." : !sellerReady ? "Seller payout account is not ready." : undefined,
    },
    {
      provider: PaymentProvider.paypal,
      label: "PayPal",
      enabled: Boolean(configuration?.allowPayPal && paypal),
      reason: !configuration?.allowPayPal ? "PayPal is disabled for this country/currency." : !paypal ? "No active PayPal gateway supports this country/currency." : undefined,
    },
    {
      provider: PaymentProvider.google_pay,
      label: "Google Pay through supported gateway",
      enabled: Boolean(configuration?.allowGooglePay && stripe && gatewaySettingEnabled(stripe, "supports_google_pay_wallet")),
      walletBackedBy: PaymentProvider.stripe,
      reason: "Google Pay appears only when the device, browser, country, currency, and gateway support it. Direct Google Pay tokenization is disabled.",
    },
    {
      provider: PaymentProvider.manual,
      label: "Manual/offline payment",
      enabled: manualAllowed,
      reason: manualAllowed ? undefined : "Manual payments are disabled for this country/currency.",
    },
  ] satisfies AvailablePaymentMethod[];
}

type GatewayWithSettings = PaymentGateway & { settings: PaymentGatewaySetting[] };

function gatewaySupports(gateways: GatewayWithSettings[], provider: PaymentProvider, countryCode: string, currencyCode: string) {
  return gateways.find((gateway) => {
    if (gateway.provider !== provider) return false;
    const countries = Array.isArray(gateway.supportedCountriesJson) ? gateway.supportedCountriesJson.map(String) : [];
    const currencies = Array.isArray(gateway.supportedCurrenciesJson) ? gateway.supportedCurrenciesJson.map(String) : [];
    return (!countries.length || countries.includes(countryCode)) && (!currencies.length || currencies.includes(currencyCode));
  });
}

function gatewaySettingEnabled(gateway: GatewayWithSettings, settingKey: string) {
  const setting = gateway.settings.find((item) => item.settingKey === settingKey);
  return setting?.settingValueJson === true || setting?.settingValueJson === "true";
}

async function sellerCanReceiveMarketplacePayment(organizationId: string) {
  const account = await prisma.sellerPayoutAccount.findUnique({ where: { organizationId_provider: { organizationId, provider: PaymentProvider.stripe } } });
  return !account || (account.status === "active" && account.chargesEnabled);
}
