import { z } from "zod";

const nullableString = (max = 1000) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

export const sellerTypeSchema = z.enum(["chef_business", "home_catering", "restaurant"]);
export const requirementTypeSchema = z.enum([
  "identity",
  "business_info",
  "food_handler_certificate",
  "local_permit",
  "kitchen_photos",
  "background_check",
  "payout_onboarding",
  "insurance",
  "tax_form",
  "platform_attestation",
  "trial_taste_test",
  "other",
]);

export const sellerRequirementSchema = z.object({
  requirementId: nullableString(120).optional(),
  countryCode: nullableString(2).optional(),
  region: nullableString(120).optional(),
  sellerType: sellerTypeSchema,
  requirementType: requirementTypeSchema,
  title: z.string().trim().min(2).max(180),
  description: nullableString(1200).optional(),
  isRequired: z.coerce.boolean().default(false),
  provider: z.enum(["manual", "stripe_identity", "stripe_connect", "persona_placeholder", "checkr_placeholder", "local_admin_review", "other"]).default("manual"),
  validityDays: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : Number(value)), z.number().int().min(1).max(3650).nullable()).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const sellerVerificationDocumentSchema = z.object({
  requirementId: nullableString(120).optional(),
  requirementType: requirementTypeSchema,
  documentFileId: z.string().trim().min(1).max(120),
  expiresAt: nullableString(80).optional(),
});

export const sellerAttestationSchema = z.object({
  attestationType: z.enum([
    "food_safety_responsibility",
    "cottage_food_compliance",
    "background_check_consent",
    "seller_terms",
    "tax_responsibility",
    "kitchen_safety_attestation",
    "local_law_acknowledgement",
  ]),
  version: z.string().trim().min(1).max(40).default("v1"),
  textSnapshot: z.string().trim().min(20).max(5000),
});

export const sellerVerificationSubmitSchema = z.object({
  note: nullableString(1000).optional(),
});

export const sellerVerificationItemReviewSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(["approved", "rejected", "expired", "provider_failed", "provider_pending"]),
  rejectionReason: nullableString(1000).optional(),
});

export const sellerVerificationProfileReviewSchema = z.object({
  profileId: z.string().min(1),
  status: z.enum(["under_review", "verified", "rejected", "expired", "suspended"]),
  verificationLevel: z.enum(["unverified", "profile_verified", "identity_verified", "food_safety_verified", "kitchen_reviewed", "background_checked", "fully_verified"]),
  rejectionReason: nullableString(1200).optional(),
  adminNotes: nullableString(2000).optional(),
});

export const kitchenPhotoSchema = z.object({
  fileId: z.string().trim().min(1).max(120),
  category: z.enum(["cooking_area", "sink_sanitation", "refrigerator_storage", "dry_storage", "prep_surface", "packaging_area", "handwashing", "other"]),
  caption: nullableString(500).optional(),
});
