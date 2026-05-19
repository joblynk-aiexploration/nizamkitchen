import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { decryptGatewayCredential } from "@/server/payments/credentials";
import { PaymentConfigurationError } from "@/server/payments/payment-errors";

export const STRIPE_API_VERSION = "2026-04-22.dahlia";

export type StripeGatewaySecrets = {
  publishableKey?: string;
  secretKey: string;
  webhookSecret?: string;
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
  if (!gateway || gateway.provider !== "stripe" || gateway.status !== "active") {
    throw new PaymentConfigurationError("Stripe gateway is not configured or is disabled.");
  }
  const countries = Array.isArray(gateway.supportedCountriesJson) ? gateway.supportedCountriesJson.map(String) : [];
  const currencies = Array.isArray(gateway.supportedCurrenciesJson) ? gateway.supportedCurrenciesJson.map(String) : [];
  if (countryCode && countries.length && !countries.includes(countryCode)) {
    throw new PaymentConfigurationError("Stripe is not enabled for this country.");
  }
  if (currencyCode && currencies.length && !currencies.includes(currencyCode)) {
    throw new PaymentConfigurationError("Stripe is not enabled for this currency.");
  }
  return gateway;
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
