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
  category: z.enum(["cooking_area", "sink_sanitation", "refrigerator_storage", "dry_storage", "prep_surface", "packaging_area", "waste_trash_area", "pet_separation", "handwashing", "other"]),
  caption: nullableString(500).optional(),
});

const dateString = nullableString(80).optional();
const reviewScore = z.preprocess((value) => (value === "" || value === null || value === undefined ? null : Number(value)), z.number().int().min(1).max(5).nullable()).optional();

export const foodSafetyCertificateSchema = z.object({
  fileId: z.string().trim().min(1).max(120),
  providerName: nullableString(160).optional(),
  certificateNumber: nullableString(120).optional(),
  issuedAt: dateString,
  expiresAt: dateString,
  countryCode: z.string().trim().min(2).max(2),
  region: nullableString(120).optional(),
  notes: nullableString(1000).optional(),
});

export const foodSafetyCertificateReviewSchema = z.object({
  certificateId: z.string().trim().min(1).max(120),
  status: z.enum(["approved", "rejected", "expired", "needs_more_info"]),
  expiresAt: dateString,
  rejectionReason: nullableString(1000).optional(),
});

export const sellerPermitSchema = z.object({
  permitType: z.enum(["food_establishment_permit", "cottage_food_registration", "business_license", "tax_registration", "health_department_permit", "other"]),
  fileId: z.string().trim().min(1).max(120),
  issuingAuthority: nullableString(160).optional(),
  permitNumber: nullableString(120).optional(),
  issuedAt: dateString,
  expiresAt: dateString,
});

export const sellerPermitReviewSchema = z.object({
  permitId: z.string().trim().min(1).max(120),
  status: z.enum(["approved", "rejected", "expired", "needs_more_info"]),
  expiresAt: dateString,
  rejectionReason: nullableString(1000).optional(),
});

export const kitchenSafetyReviewSchema = z.object({
  reviewId: z.string().trim().min(1).max(120),
  status: z.enum(["approved", "rejected", "needs_more_info", "under_review"]),
  cleanlinessScore: reviewScore,
  storageScore: reviewScore,
  sanitationScore: reviewScore,
  packagingScore: reviewScore,
  cleanPrepSurfaces: z.coerce.boolean().default(false),
  handwashingSanitation: z.coerce.boolean().default(false),
  safeFoodStorage: z.coerce.boolean().default(false),
  organizedDryStorage: z.coerce.boolean().default(false),
  properPackagingArea: z.coerce.boolean().default(false),
  noPetsInPrepArea: z.coerce.boolean().default(false),
  notes: nullableString(2000).optional(),
});

export const sellerTrialReviewSchema = z.object({
  trialReviewId: nullableString(120).optional(),
  profileId: z.string().trim().min(1).max(120),
  status: z.enum(["not_required", "requested", "scheduled", "submitted", "approved", "rejected", "waived"]),
  scheduledAt: dateString,
  dishName: nullableString(180).optional(),
  tasteScore: reviewScore,
  packagingScore: reviewScore,
  presentationScore: reviewScore,
  notes: nullableString(2000).optional(),
});
