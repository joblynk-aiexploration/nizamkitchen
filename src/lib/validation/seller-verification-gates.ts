import { SellerType } from "@prisma/client";
import { z } from "zod";

const sellerTypes = Object.values(SellerType) as [SellerType, ...SellerType[]];

export const sellerVerificationPolicySchema = z.object({
  policyId: z.string().optional(),
  countryCode: z.string().trim().toUpperCase().min(2).max(3).optional().or(z.literal("")),
  region: z.string().trim().max(80).optional().or(z.literal("")),
  sellerType: z.enum(sellerTypes),
  policyName: z.string().trim().min(2).max(120),
  status: z.enum(["active", "disabled"]).default("active"),
  allowPublicProfileBeforeVerification: z.coerce.boolean().default(false),
  allowMenuPublishingBeforeVerification: z.coerce.boolean().default(false),
  allowOrderAcceptanceBeforeVerification: z.coerce.boolean().default(false),
  allowPayoutsBeforeVerification: z.coerce.boolean().default(false),
  requireIdentityVerification: z.coerce.boolean().default(false),
  requireFoodHandlerCertificate: z.coerce.boolean().default(false),
  requireLocalPermit: z.coerce.boolean().default(false),
  requireKitchenReview: z.coerce.boolean().default(false),
  requireBackgroundCheck: z.coerce.boolean().default(false),
  requirePayoutOnboarding: z.coerce.boolean().default(false),
  requireAdminApproval: z.coerce.boolean().default(true),
});

export const sellerVerificationOverrideSchema = z.object({
  organizationId: z.string().min(1),
  policyId: z.string().optional().or(z.literal("")),
  reason: z.string().trim().min(8).max(500),
  expiresAt: z.preprocess((value) => value === "" ? null : value, z.coerce.date().optional().nullable()),
});

export const sellerVerificationOverrideRevokeSchema = z.object({
  overrideId: z.string().min(1),
});
