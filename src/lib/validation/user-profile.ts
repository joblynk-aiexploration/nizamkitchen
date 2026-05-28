import { z } from "zod";
import { isFormattedPhoneNumber } from "@/lib/phone";
import { isSupportedReligion } from "@/lib/religion";

const nullableString = (max = 500) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

const nullableNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().finite().nullable(),
);

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  profilePhotoFileId: nullableString(120).optional(),
  coverPhotoFileId: nullableString(120).optional(),
  headline: nullableString(180).optional(),
  bio: nullableString(1200).optional(),
  locationText: nullableString(180).optional(),
  phone: nullableString(40).optional().refine(isFormattedPhoneNumber, "Phone number must include a country code and a 10 digit number."),
  religion: nullableString(40).optional().refine(isSupportedReligion, "Choose a supported religion option."),
  preferredLanguage: nullableString(80).optional(),
  addressLine1: nullableString(180).optional(),
  addressLine2: nullableString(180).optional(),
  city: nullableString(100).optional(),
  region: nullableString(100).optional(),
  countryCode: nullableString(2).optional(),
  postalCode: nullableString(30).optional(),
  latitude: nullableNumber.optional().catch(null),
  longitude: nullableNumber.optional().catch(null),
  providerPlaceId: nullableString(180).optional(),
  locationVisibility: z.enum(["private", "organization", "public_city_only", "public_full"]).default("private"),
  publicProfileEnabled: z.coerce.boolean().default(false),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;
