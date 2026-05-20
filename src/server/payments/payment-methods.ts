import { OrganizationType, PaymentProvider, SellerType, type PaymentGateway, type PaymentGatewaySetting, type PaymentModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSellerVerificationGate } from "@/server/seller-verification-gates";

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
      enabled: Boolean(configuration?.allowPayPal && paypal && sellerReady),
      reason: !configuration?.allowPayPal ? "PayPal is disabled for this country/currency." : !paypal ? "No active PayPal gateway supports this country/currency." : !sellerReady ? "Seller payout account is not ready." : undefined,
    },
    {
      provider: PaymentProvider.google_pay,
      label: "Google Pay through supported gateway",
      enabled: Boolean(configuration?.allowGooglePay && stripe && sellerReady && gatewaySettingEnabled(stripe, "supports_google_pay_wallet")),
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
  if (account && (account.status !== "active" || !account.chargesEnabled)) return false;
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { organizationType: true, countryCode: true } });
  const sellerType = sellerTypeFromOrganizationType(organization?.organizationType ?? null);
  if (!organization || !sellerType) return true;
  const gate = await getSellerVerificationGate({ organizationId, sellerType, countryCode: organization.countryCode, capability: "payouts" });
  return gate.allowed;
}

function sellerTypeFromOrganizationType(organizationType: OrganizationType | null): SellerType | null {
  if (organizationType === OrganizationType.home_catering) return SellerType.home_catering;
  if (organizationType === OrganizationType.restaurant) return SellerType.restaurant;
  if (organizationType === OrganizationType.chef_business) return SellerType.chef_business;
  return null;
}
