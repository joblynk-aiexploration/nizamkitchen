import { PaymentEnvironment, PaymentGatewayStatus, PaymentProvider, PaymentConfigurationStatus, PaymentModule } from "@prisma/client";
import { z } from "zod";

const jsonList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => {
    if (Array.isArray(value)) return value.map((item) => item.trim().toUpperCase()).filter(Boolean);
    return value
      .split(/[\n,]/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  });

const optionalAmount = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .pipe(z.number().min(0).optional());

export const paymentGatewaySchema = z.object({
  id: z.string().optional(),
  provider: z.nativeEnum(PaymentProvider),
  displayName: z.string().trim().min(2).max(120),
  status: z.nativeEnum(PaymentGatewayStatus).default(PaymentGatewayStatus.draft),
  environment: z.nativeEnum(PaymentEnvironment).default(PaymentEnvironment.sandbox),
  countryCode: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
  supportedCountries: jsonList.default([]),
  supportedCurrencies: jsonList.default([]),
  priority: z.coerce.number().int().min(0).max(10_000).default(100),
  isDefault: z.coerce.boolean().default(false),
  isPlatformGateway: z.coerce.boolean().default(true),
});

export const paymentGatewayCredentialSchema = z.object({
  gatewayId: z.string().min(1),
  keyName: z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
  secretValue: z.string().trim().min(8).max(10_000),
});

export const paymentConfigurationSchema = z.object({
  id: z.string().optional(),
  countryCode: z.string().trim().length(2).toUpperCase(),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  defaultGatewayId: z.string().optional().or(z.literal("")),
  allowStripe: z.coerce.boolean().default(false),
  allowPayPal: z.coerce.boolean().default(false),
  allowGooglePay: z.coerce.boolean().default(false),
  allowManualPayment: z.coerce.boolean().default(true),
  platformCommissionPercent: optionalAmount,
  fixedCommissionAmount: optionalAmount,
  taxPercent: optionalAmount,
  status: z.nativeEnum(PaymentConfigurationStatus).default(PaymentConfigurationStatus.active),
});

export const paymentOrderCreateSchema = z.object({
  organizationId: z.string().min(1),
  countryCode: z.string().trim().length(2).toUpperCase(),
  customerOrganizationId: z.string().optional(),
  customerUserId: z.string().optional(),
  sellerOrganizationId: z.string().optional(),
  module: z.nativeEnum(PaymentModule),
  moduleEntityId: z.string().min(1),
  provider: z.nativeEnum(PaymentProvider).default(PaymentProvider.manual),
  gatewayId: z.string().optional(),
  amount: z.number().positive(),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  idempotencyKey: z.string().trim().min(8).max(160),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});
