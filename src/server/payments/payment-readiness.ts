import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CredentialRecord = {
  keyName: string;
  encryptedValue: string;
};

type SettingRecord = {
  settingKey: string;
  settingValueJson: Prisma.JsonValue;
};

type StripeReadinessSource = "payment_gateway" | "api_management";

export type StripePaymentReadiness = {
  configured: boolean;
  source: StripeReadinessSource | null;
  providerLabel: string;
  missingFields: string[];
  message: string;
};

export async function getStripePaymentReadiness(input: { countryCode?: string | null; currencyCode?: string | null } = {}): Promise<StripePaymentReadiness> {
  const [gateway, integration] = await Promise.all([
    prisma.paymentGateway.findFirst({
      where: {
        provider: "stripe",
        status: "active",
        ...(input.countryCode ? { OR: [{ countryCode: input.countryCode }, { countryCode: null }] } : {}),
      },
      include: { credentials: { select: { keyName: true, encryptedValue: true } }, settings: true },
      orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
    }),
    prisma.platformIntegration.findFirst({
      where: {
        provider: "stripe",
        status: "active",
        ...(input.countryCode ? { OR: [{ countryCode: input.countryCode }, { countryCode: null }] } : {}),
      },
      include: { credentials: { select: { keyName: true, encryptedValue: true } }, settings: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const gatewayReadiness = gateway
    ? readinessFromCredentials({
        source: "payment_gateway",
        providerLabel: "Stripe payment gateway",
        credentials: gateway.credentials,
        supportedCountries: jsonList(gateway.supportedCountriesJson),
        supportedCurrencies: jsonList(gateway.supportedCurrenciesJson),
        countryCode: input.countryCode,
        currencyCode: input.currencyCode,
      })
    : null;

  if (gatewayReadiness?.configured) return gatewayReadiness;

  const integrationReadiness = integration
    ? readinessFromCredentials({
        source: "api_management",
        providerLabel: "Stripe API Management",
        credentials: integration.credentials,
        supportedCountries: integration.countryCode ? [integration.countryCode] : settingList(integration.settings, "supportedCountries"),
        supportedCurrencies: settingList(integration.settings, "supportedCurrencies"),
        countryCode: input.countryCode,
        currencyCode: input.currencyCode,
      })
    : null;

  if (integrationReadiness) return integrationReadiness;
  if (gatewayReadiness) return gatewayReadiness;

  return {
    configured: false,
    source: null,
    providerLabel: "Manual only",
    missingFields: ["Stripe secret key"],
    message: "No active Stripe payment setup was found. Configure Stripe in Admin > API Management or Admin > Payments > Gateways.",
  };
}

function readinessFromCredentials(input: {
  source: StripeReadinessSource;
  providerLabel: string;
  credentials: CredentialRecord[];
  supportedCountries: string[];
  supportedCurrencies: string[];
  countryCode?: string | null;
  currencyCode?: string | null;
}): StripePaymentReadiness {
  const missingFields = [];
  if (!input.credentials.some((credential) => credential.keyName === "secret_key" && credential.encryptedValue)) {
    missingFields.push("Stripe secret key");
  }
  if (input.countryCode && input.supportedCountries.length && !input.supportedCountries.includes(input.countryCode)) {
    missingFields.push(`country ${input.countryCode}`);
  }
  if (input.currencyCode && input.supportedCurrencies.length && !input.supportedCurrencies.includes(input.currencyCode.toUpperCase())) {
    missingFields.push(`currency ${input.currencyCode.toUpperCase()}`);
  }

  return {
    configured: missingFields.length === 0,
    source: input.source,
    providerLabel: input.providerLabel,
    missingFields,
    message: missingFields.length
      ? `${input.providerLabel} is missing: ${missingFields.join(", ")}.`
      : `${input.providerLabel} is active and ready for hosted checkout.`,
  };
}

function settingList(settings: SettingRecord[], key: string) {
  const value = settings.find((setting) => setting.settingKey === key)?.settingValueJson;
  return jsonList(value);
}

function jsonList(value: Prisma.JsonValue | undefined | null) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  return [];
}
