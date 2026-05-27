import { z } from "zod";
import { isFormattedPhoneNumber } from "@/lib/phone";

const chefServiceTypeValues = [
  "daily_cooking",
  "weekly_cooking",
  "occasion",
  "meal_prep",
  "recipe_specific",
  "custom",
] as const;

const chefPriceUnitValues = [
  "per_visit",
  "per_day",
  "per_week",
  "per_event",
  "per_guest",
  "custom",
] as const;

const chefProfileStatusValues = ["draft", "active", "paused", "suspended", "disabled"] as const;
const chefVerificationStatusValues = ["unverified", "pending", "verified", "rejected"] as const;
const reviewStatusValues = ["pending", "published", "hidden"] as const;

const nullableString = (max = 500) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

const listFromFormValue = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string().min(1).max(80)).max(40));

export const chefProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(140),
  bio: z.string().trim().min(20).max(2000),
  profilePhotoUrl: nullableString(500).optional(),
  profilePhotoFileId: nullableString(120).optional(),
  coverPhotoFileId: nullableString(120).optional(),
  languages: listFromFormValue.default([]),
  specialties: listFromFormValue.default([]),
  yearsExperience: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().min(0).max(80).nullable(),
  ).optional(),
  serviceRadiusKm: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().min(0).max(1000).nullable(),
  ).optional(),
  baseCity: nullableString(120).optional(),
  baseRegion: nullableString(120).optional(),
  postalCode: nullableString(40).optional(),
  phone: nullableString(40).optional().refine(isFormattedPhoneNumber, "Phone number must include a country code and a 10 digit number."),
  email: nullableString(180).optional(),
  submitForVerification: z.coerce.boolean().default(false),
});

export const chefServiceSchema = z
  .object({
    serviceId: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.string().min(1).optional(),
    ),
    name: z.string().trim().min(2).max(140),
    description: nullableString(1000).optional(),
    serviceType: z.enum(chefServiceTypeValues),
    basePriceAmount: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
      z.number().min(0).max(1_000_000).nullable(),
    ).optional(),
    currencyCode: z.string().trim().toUpperCase().length(3),
    priceUnit: z.enum(chefPriceUnitValues),
    minGuests: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
      z.number().int().min(1).max(10000).nullable(),
    ).optional(),
    maxGuests: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
      z.number().int().min(1).max(10000).nullable(),
    ).optional(),
    isActive: z.coerce.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.minGuests && value.maxGuests && value.maxGuests < value.minGuests) {
      ctx.addIssue({
        code: "custom",
        path: ["maxGuests"],
        message: "Maximum guests must be greater than or equal to minimum guests.",
      });
    }
  });

export const chefSpecialtySchema = z.object({
  recipeId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().min(1).nullable(),
  ).optional(),
  dishName: z.string().trim().min(2).max(140),
  notes: nullableString(600).optional(),
});

export const chefAvailabilitySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.coerce.boolean().default(true),
});

export const chefProfileAdminStatusSchema = z.object({
  status: z.enum(chefProfileStatusValues).optional(),
  verificationStatus: z.enum(chefVerificationStatusValues).optional(),
  isPublic: z.coerce.boolean().optional(),
  adminNotes: nullableString(1000).optional(),
});

export const chefReviewSchema = z.object({
  chefProfileId: z.string().min(1),
  homeChefRequestId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().min(1).nullable(),
  ).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: nullableString(1200).optional(),
});

export const chefReviewAdminSchema = z.object({
  status: z.enum(reviewStatusValues),
});

export type ChefProfileInput = z.infer<typeof chefProfileSchema>;
export type ChefServiceInput = z.infer<typeof chefServiceSchema>;
export type ChefSpecialtyInput = z.infer<typeof chefSpecialtySchema>;
export type ChefAvailabilityInput = z.infer<typeof chefAvailabilitySchema>;
