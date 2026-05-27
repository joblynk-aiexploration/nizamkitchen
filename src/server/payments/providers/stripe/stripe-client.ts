import Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptGatewayCredential } from "@/server/payments/credentials";
import { PaymentConfigurationError } from "@/server/payments/payment-errors";

export const STRIPE_API_VERSION = "2026-04-22.dahlia";

export type StripeGatewaySecrets = {
  publishableKey?: string;
  secretKey: string;
  webhookSecret?: string;
};

type StripeCredential = {
  keyName: string;
  encryptedValue: string;
};

type StripeSetting = {
  settingKey: string;
  settingValueJson: Prisma.JsonValue;
};

type StripeGatewayConfig = {
  id: string;
  provider: "stripe";
  status: "active";
  countryCode: string | null;
  supportedCountriesJson: Prisma.JsonValue;
  supportedCurrenciesJson: Prisma.JsonValue;
  credentials: StripeCredential[];
  settings: StripeSetting[];
};

export async function getStripeGateway(gatewayId?: string | null, countryCode?: string, currencyCode?: string) {
  const gateway = gatewayId
    ? await prisma.paymentGateway.findUnique({ where: { id: gatewayId }, include: { credentials: true, settings: true } })
    : await prisma.paymentGateway.findFirst({
        where: {
          provider: "stripe",
          status: "active",
          ...(countryCode ? { OR: [{ countryCode }, { countryCode: null }] } : {}),
        },
        include: { credentials: true, settings: true },
        orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
      });
  const resolvedGateway: StripeGatewayConfig | null = gateway && gateway.provider === "stripe" && gateway.status === "active"
    ? {
        id: gateway.id,
        provider: "stripe",
        status: "active",
        countryCode: gateway.countryCode,
        supportedCountriesJson: gateway.supportedCountriesJson,
        supportedCurrenciesJson: gateway.supportedCurrenciesJson,
        credentials: gateway.credentials,
        settings: gateway.settings,
      }
    : gatewayId ? null : await getStripeApiManagementGateway(countryCode, currencyCode);

  if (!resolvedGateway) {
    throw new PaymentConfigurationError("Stripe gateway is not configured or is disabled.");
  }
  const countries = jsonList(resolvedGateway.supportedCountriesJson);
  const currencies = jsonList(resolvedGateway.supportedCurrenciesJson);
  if (countryCode && countries.length && !countries.includes(countryCode)) {
    throw new PaymentConfigurationError("Stripe is not enabled for this country.");
  }
  if (currencyCode && currencies.length && !currencies.includes(currencyCode.toUpperCase())) {
    throw new PaymentConfigurationError("Stripe is not enabled for this currency.");
  }
  return resolvedGateway;
}

export function getStripeSecrets(gateway: Awaited<ReturnType<typeof getStripeGateway>>): StripeGatewaySecrets {
  const secret = (keyName: string) => gateway.credentials.find((credential) => credential.keyName === keyName)?.encryptedValue;
  const secretKey = secret("secret_key");
  if (!secretKey) throw new PaymentConfigurationError("Stripe secret key is not configured.");
  return {
    publishableKey: secret("publishable_key") ? decryptGatewayCredential(secret("publishable_key")!) : undefined,
    secretKey: decryptGatewayCredential(secretKey),
    webhookSecret: secret("webhook_secret") ? decryptGatewayCredential(secret("webhook_secret")!) : undefined,
  };
}

export function createStripeClient(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

async function getStripeApiManagementGateway(countryCode?: string, currencyCode?: string): Promise<StripeGatewayConfig | null> {
  const integration = await prisma.platformIntegration.findFirst({
    where: {
      provider: "stripe",
      status: "active",
      ...(countryCode ? { OR: [{ countryCode }, { countryCode: null }] } : {}),
    },
    include: { credentials: true, settings: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  if (!integration) return null;
  const supportedCountries = integration.countryCode ? [integration.countryCode] : settingList(integration.settings, "supportedCountries");
  const supportedCurrencies = settingList(integration.settings, "supportedCurrencies");
  if (countryCode && supportedCountries.length && !supportedCountries.includes(countryCode.toUpperCase())) return null;
  if (currencyCode && supportedCurrencies.length && !supportedCurrencies.includes(currencyCode.toUpperCase())) return null;

  return {
    id: integration.id,
    provider: "stripe",
    status: "active",
    countryCode: integration.countryCode,
    supportedCountriesJson: supportedCountries,
    supportedCurrenciesJson: supportedCurrencies,
    credentials: integration.credentials,
    settings: integration.settings,
  };
}

function settingList(settings: StripeSetting[], key: string) {
  const value = settings.find((setting) => setting.settingKey === key)?.settingValueJson;
  return jsonList(value);
}

function jsonList(value: Prisma.JsonValue | undefined | null) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  return [];
}
