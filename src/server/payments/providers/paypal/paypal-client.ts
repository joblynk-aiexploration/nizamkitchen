import { prisma } from "@/lib/prisma";
import { decryptGatewayCredential } from "@/server/payments/credentials";
import { PaymentConfigurationError } from "@/server/payments/payment-errors";

export type PayPalGatewaySecrets = {
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  merchantId?: string;
};

export async function getPayPalGateway(gatewayId?: string | null, countryCode?: string, currencyCode?: string) {
  const gateway = gatewayId
    ? await prisma.paymentGateway.findUnique({ where: { id: gatewayId }, include: { credentials: true, settings: true } })
    : await prisma.paymentGateway.findFirst({
        where: {
          provider: "paypal",
          status: "active",
          ...(countryCode ? { OR: [{ countryCode }, { countryCode: null }] } : {}),
        },
        include: { credentials: true, settings: true },
        orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
      });
  if (!gateway || gateway.provider !== "paypal" || gateway.status !== "active") {
    throw new PaymentConfigurationError("PayPal gateway is not configured or is disabled.");
  }
  const countries = Array.isArray(gateway.supportedCountriesJson) ? gateway.supportedCountriesJson.map(String) : [];
  const currencies = Array.isArray(gateway.supportedCurrenciesJson) ? gateway.supportedCurrenciesJson.map(String) : [];
  if (countryCode && countries.length && !countries.includes(countryCode)) throw new PaymentConfigurationError("PayPal is not enabled for this country.");
  if (currencyCode && currencies.length && !currencies.includes(currencyCode)) throw new PaymentConfigurationError("PayPal is not enabled for this currency.");
  return gateway;
}

export function getPayPalSecrets(gateway: Awaited<ReturnType<typeof getPayPalGateway>>): PayPalGatewaySecrets {
  const encrypted = (keyName: string) => gateway.credentials.find((credential) => credential.keyName === keyName)?.encryptedValue;
  const clientId = encrypted("client_id");
  const clientSecret = encrypted("client_secret");
  if (!clientId || !clientSecret) throw new PaymentConfigurationError("PayPal client ID and client secret are required.");
  return {
    clientId: decryptGatewayCredential(clientId),
    clientSecret: decryptGatewayCredential(clientSecret),
    webhookId: encrypted("webhook_id") ? decryptGatewayCredential(encrypted("webhook_id")!) : undefined,
    merchantId: encrypted("merchant_id") ? decryptGatewayCredential(encrypted("merchant_id")!) : undefined,
  };
}

export function paypalApiBase(environment: "sandbox" | "live") {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken(params: { apiBase: string; clientId: string; clientSecret: string }) {
  const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString("base64");
  const response = await fetch(`${params.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new PaymentConfigurationError("Unable to authenticate with PayPal.");
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new PaymentConfigurationError("PayPal did not return an access token.");
  return data.access_token;
}

export async function paypalFetch<T>(params: { apiBase: string; accessToken: string; path: string; method?: string; body?: unknown }) {
  const response = await fetch(`${params.apiBase}${params.path}`, {
    method: params.method ?? "GET",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data === "object" && data && "message" in data ? String(data.message) : "PayPal API request failed.");
  return data as T;
}
