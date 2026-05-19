import crypto from "node:crypto";
import { env } from "@/lib/env";
import { PaymentConfigurationError } from "@/server/payments/payment-errors";

const ENCRYPTION_VERSION = "v1";

function encryptionKey() {
  if (!env.ENCRYPTION_KEY) {
    throw new PaymentConfigurationError("ENCRYPTION_KEY is required before saving payment gateway credentials.");
  }
  return crypto.createHash("sha256").update(env.ENCRYPTION_KEY).digest();
}

export function isPaymentEncryptionConfigured() {
  return Boolean(env.ENCRYPTION_KEY);
}

export function encryptGatewayCredential(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptGatewayCredential(encryptedValue: string) {
  const [version, ivText, tagText, encryptedText] = encryptedValue.split(":");
  if (version !== ENCRYPTION_VERSION || !ivText || !tagText || !encryptedText) {
    throw new PaymentConfigurationError("Payment credential is not in a supported encrypted format.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
}

export function maskCredentialPreview(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "****";
  const prefix = trimmed.slice(0, Math.min(7, Math.max(2, trimmed.indexOf("_") + 6 || 4)));
  const suffix = trimmed.slice(-4);
  return `${prefix}****${suffix}`;
}
