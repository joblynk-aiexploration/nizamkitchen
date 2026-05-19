import { prisma } from "@/lib/prisma";
import { userProfileSchema } from "@/lib/validation/user-profile";
import { createAuditEvent } from "@/server/audit";
import { assertStorageFileBelongsToUser } from "@/server/storage/storage-images";

export async function updateUserProfile(params: { userId: string; input: unknown }) {
  const parsed = userProfileSchema.parse(params.input);
  await Promise.all([
    assertStorageFileBelongsToUser(parsed.profilePhotoFileId, params.userId),
    assertStorageFileBelongsToUser(parsed.coverPhotoFileId, params.userId),
  ]);

  const user = await prisma.user.update({
    where: { id: params.userId },
    data: {
      fullName: parsed.fullName,
      profilePhotoFileId: parsed.profilePhotoFileId ?? null,
      coverPhotoFileId: parsed.coverPhotoFileId ?? null,
      headline: parsed.headline ?? null,
      bio: parsed.bio ?? null,
      location: parsed.locationText ?? null,
      locationText: parsed.locationText ?? null,
      phone: parsed.phone ?? null,
      preferredLanguage: parsed.preferredLanguage ?? null,
      publicProfileEnabled: parsed.publicProfileEnabled,
    },
  });

  await createAuditEvent({
    actorUserId: params.userId,
    action: "profile_photo.uploaded",
    targetType: "user",
    targetId: user.id,
    details: { profilePhotoFileId: user.profilePhotoFileId, coverPhotoFileId: user.coverPhotoFileId },
  });

  return user;
}

export function getUserProfileCompletion(user: {
  profilePhotoFileId?: string | null;
  coverPhotoFileId?: string | null;
  headline?: string | null;
  bio?: string | null;
  locationText?: string | null;
  location?: string | null;
}) {
  const checks = [
    Boolean(user.profilePhotoFileId),
    Boolean(user.coverPhotoFileId),
    Boolean(user.headline),
    Boolean(user.bio),
    Boolean(user.locationText ?? user.location),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function getBusinessProfileCompletion(profile: {
  profilePhotoFileId?: string | null;
  coverPhotoFileId?: string | null;
  logoFileId?: string | null;
  profilePhotoUrl?: string | null;
  coverPhotoUrl?: string | null;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  verificationStatus?: string | null;
  specialties?: unknown;
  cuisineSpecialtiesJson?: unknown;
}, counts?: { services?: number; menuItems?: number; socialLinks?: number }) {
  const hasSpecialties = Array.isArray(profile.specialties)
    ? profile.specialties.length > 0
    : Array.isArray(profile.cuisineSpecialtiesJson) && profile.cuisineSpecialtiesJson.length > 0;
  const checks = [
    Boolean(profile.profilePhotoFileId ?? profile.profilePhotoUrl ?? profile.logoFileId),
    Boolean(profile.coverPhotoFileId ?? profile.coverPhotoUrl),
    Boolean(profile.bio),
    hasSpecialties,
    Boolean(counts?.services || counts?.menuItems),
    Boolean(counts?.socialLinks),
    Boolean(profile.phone || profile.email),
    profile.verificationStatus === "pending" || profile.verificationStatus === "verified",
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
