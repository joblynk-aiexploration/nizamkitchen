import { z } from "zod";

const nullableString = (max = 500) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  profilePhotoFileId: nullableString(120).optional(),
  coverPhotoFileId: nullableString(120).optional(),
  headline: nullableString(180).optional(),
  bio: nullableString(1200).optional(),
  locationText: nullableString(180).optional(),
  phone: nullableString(40).optional(),
  preferredLanguage: nullableString(80).optional(),
  publicProfileEnabled: z.coerce.boolean().default(false),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;
