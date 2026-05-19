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
  location: nullableString(180).optional(),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;
