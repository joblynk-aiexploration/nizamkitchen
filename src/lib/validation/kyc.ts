import { z } from "zod";

const nullableString = (max = 1000) =>
  z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.string().trim().max(max).nullable());

export const kycProviderSchema = z.enum(["stripe_identity", "stripe_connect", "persona_placeholder", "checkr_placeholder", "manual"]);

export const kycProviderConfigurationSchema = z.object({
  id: nullableString(120).optional(),
  provider: kycProviderSchema,
  displayName: z.string().trim().min(2).max(160),
  status: z.enum(["draft", "active", "disabled", "error"]).default("draft"),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
  countryCode: nullableString(2).optional(),
  supportedCountries: z.preprocess((value) => parseList(value), z.array(z.string().trim().min(2).max(2)).default([])),
  apiKey: nullableString(2000).optional(),
  secret: nullableString(2000).optional(),
  webhookSecret: nullableString(2000).optional(),
  settingsJson: z.preprocess((value) => parseJson(value), z.unknown().optional()),
});

export const identityVerificationStartSchema = z.object({
  provider: kycProviderSchema.optional(),
  returnUrl: nullableString(500).optional(),
});

export const backgroundCheckConsentSchema = z.object({
  textSnapshot: z.string().trim().min(20).max(5000),
  version: z.string().trim().min(1).max(40).default("v1"),
});

export const backgroundCheckRequestSchema = z.object({
  verificationProfileId: z.string().trim().min(1).max(120),
  provider: z.enum(["manual", "checkr_placeholder"]).default("manual"),
});

export const backgroundCheckStatusSchema = z.object({
  backgroundCheckId: z.string().trim().min(1).max(120),
  status: z.enum(["not_started", "consent_required", "consent_collected", "requested", "pending", "clear", "consider", "suspended", "failed", "cancelled"]),
  resultSummary: nullableString(1000).optional(),
});

function parseList(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function parseJson(value: unknown) {
  if (!value) return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}
