import { prisma } from "@/lib/prisma";
import { userProfileSchema } from "@/lib/validation/user-profile";
import { createAuditEvent } from "@/server/audit";
import { upsertPrimaryLocation } from "@/server/maps/location-service";
import { listEnabledLanguageOptions } from "@/server/localization/localization-service";
import { assertStorageFileBelongsToUser } from "@/server/storage/storage-images";

function normalizeRemoteAvatarUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("/api/users/")) return value;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function avatarUrlFromRawProfile(rawProfileJson: unknown) {
  if (!rawProfileJson || typeof rawProfileJson !== "object") return null;
  const profile = rawProfileJson as {
    picture?: unknown;
  };

  if (typeof profile.picture === "string") {
    return normalizeRemoteAvatarUrl(profile.picture);
  }

  if (profile.picture && typeof profile.picture === "object") {
    const facebookPicture = profile.picture as { data?: { url?: unknown } };
    if (typeof facebookPicture.data?.url === "string") {
      return normalizeRemoteAvatarUrl(facebookPicture.data.url);
    }
  }

  return null;
}

function hasAddressInput(input: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerPlaceId?: string | null;
}) {
  return Boolean(
    input.addressLine1 ||
      input.addressLine2 ||
      input.city ||
      input.region ||
      input.postalCode ||
      input.latitude != null ||
      input.longitude != null ||
      input.providerPlaceId,
  );
}

export async function updateUserProfile(params: { userId: string; input: unknown }) {
  const parsed = userProfileSchema.parse(params.input);
  await Promise.all([
    assertStorageFileBelongsToUser(parsed.profilePhotoFileId, params.userId),
    assertStorageFileBelongsToUser(parsed.coverPhotoFileId, params.userId),
  ]);

  const existingWithEmail = await prisma.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });
  if (existingWithEmail && existingWithEmail.id !== params.userId) {
    throw new Error("That email address is already used by another account.");
  }
  if (parsed.preferredLanguage) {
    const languageOptions = await listEnabledLanguageOptions();
    const allowedLanguages = new Set(languageOptions.map((option) => option.value));
    if (allowedLanguages.size > 0 && !allowedLanguages.has(parsed.preferredLanguage)) {
      throw new Error("Choose a supported preferred language.");
    }
  }

  const user = await prisma.user.update({
    where: { id: params.userId },
    data: {
      email: parsed.email,
      fullName: parsed.fullName,
      profilePhotoFileId: parsed.profilePhotoFileId ?? null,
      coverPhotoFileId: parsed.coverPhotoFileId ?? null,
      headline: parsed.headline ?? null,
      bio: parsed.bio ?? null,
      location: parsed.locationText ?? null,
      locationText: parsed.locationText ?? null,
      phone: parsed.phone ?? null,
      religion: parsed.religion ?? null,
      preferredLanguage: parsed.preferredLanguage ?? null,
      publicProfileEnabled: parsed.publicProfileEnabled,
    },
  });

  if (hasAddressInput(parsed)) {
    await upsertPrimaryLocation({
      userId: params.userId,
      entityType: "user",
      entityId: params.userId,
      label: "Primary address",
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2,
      city: parsed.city,
      region: parsed.region,
      countryCode: parsed.countryCode ?? "US",
      postalCode: parsed.postalCode,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      providerPlaceId: parsed.providerPlaceId,
      visibility: parsed.locationVisibility,
    });
  }

  await createAuditEvent({
    actorUserId: params.userId,
    action: "profile_photo.uploaded",
    targetType: "user",
    targetId: user.id,
    details: {
      profilePhotoFileId: user.profilePhotoFileId,
      coverPhotoFileId: user.coverPhotoFileId,
      emailUpdated: true,
      addressUpdated: hasAddressInput(parsed),
    },
  });

  return user;
}

export function getUserProfileCompletion(user: {
  profilePhotoFileId?: string | null;
  oauthAvatarUrl?: string | null;
  oauthAccounts?: Array<{ avatarUrl?: string | null }>;
  coverPhotoFileId?: string | null;
  headline?: string | null;
  bio?: string | null;
  locationText?: string | null;
  location?: string | null;
  phone?: string | null;
}) {
  const oauthAvatarUrl = user.oauthAvatarUrl
    ?? user.oauthAccounts?.map((account) => normalizeRemoteAvatarUrl(account.avatarUrl)).find(Boolean)
    ?? null;
  const checks = [
    Boolean(user.profilePhotoFileId ?? oauthAvatarUrl),
    Boolean(user.coverPhotoFileId),
    Boolean(user.headline),
    Boolean(user.bio),
    Boolean(user.locationText ?? user.location),
    Boolean(user.phone),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function getUserOAuthAvatarUrl(userId: string) {
  const accounts = await prisma.oAuthAccount.findMany({
    where: {
      userId,
    },
    select: { avatarUrl: true, rawProfileJson: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return accounts
    .map((account) => normalizeRemoteAvatarUrl(account.avatarUrl) ?? avatarUrlFromRawProfile(account.rawProfileJson))
    .find(Boolean) ?? null;
}

export function getUserOAuthAvatarProxyUrl(userId: string, remoteAvatarUrl?: string | null) {
  return normalizeRemoteAvatarUrl(remoteAvatarUrl) ? `/api/users/${encodeURIComponent(userId)}/oauth-avatar` : null;
}

export async function getUserOAuthAvatarImageUrl(userId: string) {
  const remoteAvatarUrl = await getUserOAuthAvatarUrl(userId);
  return getUserOAuthAvatarProxyUrl(userId, remoteAvatarUrl);
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
