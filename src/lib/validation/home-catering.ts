import { z } from "zod";

const profileStatusValues = ["draft", "active", "paused", "suspended", "disabled"] as const;
const verificationStatusValues = ["unverified", "pending", "verified", "rejected"] as const;

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

export const homeCateringProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(140),
  ownerName: nullableString(140).optional(),
  bio: nullableString(2000).optional(),
  profilePhotoUrl: nullableString(500).optional(),
  coverPhotoUrl: nullableString(500).optional(),
  cuisineSpecialties: listFromFormValue.default([]),
  languages: listFromFormValue.default([]),
  serviceAreaText: nullableString(800).optional(),
  city: nullableString(120).optional(),
  region: nullableString(120).optional(),
  postalCode: nullableString(40).optional(),
  phone: nullableString(40).optional(),
  email: nullableString(180).optional(),
  acceptsPickup: z.coerce.boolean().default(false),
  acceptsDelivery: z.coerce.boolean().default(false),
  acceptsPreorders: z.coerce.boolean().default(false),
  minimumNoticeHours: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().min(0).max(720).nullable(),
  ).optional(),
  submitForVerification: z.coerce.boolean().default(false),
});

export const homeCateringAdminStatusSchema = z.object({
  status: z.enum(profileStatusValues).optional(),
  verificationStatus: z.enum(verificationStatusValues).optional(),
  isPublic: z.coerce.boolean().optional(),
  adminNotes: nullableString(1000).optional(),
});

export type HomeCateringProfileInput = z.infer<typeof homeCateringProfileSchema>;
export type HomeCateringAdminStatusInput = z.infer<typeof homeCateringAdminStatusSchema>;
