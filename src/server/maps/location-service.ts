import { LocationProvider, LocationVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type UpsertLocationInput = {
  organizationId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId: string;
  label?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerPlaceId?: string | null;
  visibility?: LocationVisibility;
  provider?: LocationProvider;
};

function normalizeNullableString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function hasMeaningfulLocation(input: UpsertLocationInput) {
  return Boolean(
    normalizeNullableString(input.addressLine1) ||
      normalizeNullableString(input.city) ||
      normalizeNullableString(input.region) ||
      normalizeNullableString(input.postalCode) ||
      input.latitude != null ||
      input.longitude != null ||
      normalizeNullableString(input.providerPlaceId),
  );
}

export async function upsertPrimaryLocation(input: UpsertLocationInput) {
  if (!hasMeaningfulLocation(input)) {
    return null;
  }

  return prisma.location.upsert({
    where: {
      entityType_entityId_isPrimary: {
        entityType: input.entityType,
        entityId: input.entityId,
        isPrimary: true,
      },
    },
    update: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      label: normalizeNullableString(input.label),
      addressLine1: normalizeNullableString(input.addressLine1),
      addressLine2: normalizeNullableString(input.addressLine2),
      city: normalizeNullableString(input.city),
      region: normalizeNullableString(input.region),
      countryCode: input.countryCode.trim().toUpperCase(),
      postalCode: normalizeNullableString(input.postalCode),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      provider:
        input.provider ??
        (normalizeNullableString(input.providerPlaceId) || input.latitude != null || input.longitude != null
          ? LocationProvider.google
          : LocationProvider.manual),
      providerPlaceId: normalizeNullableString(input.providerPlaceId),
      visibility: input.visibility ?? LocationVisibility.private,
    },
    create: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      label: normalizeNullableString(input.label),
      addressLine1: normalizeNullableString(input.addressLine1),
      addressLine2: normalizeNullableString(input.addressLine2),
      city: normalizeNullableString(input.city),
      region: normalizeNullableString(input.region),
      countryCode: input.countryCode.trim().toUpperCase(),
      postalCode: normalizeNullableString(input.postalCode),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      provider:
        input.provider ??
        (normalizeNullableString(input.providerPlaceId) || input.latitude != null || input.longitude != null
          ? LocationProvider.google
          : LocationProvider.manual),
      providerPlaceId: normalizeNullableString(input.providerPlaceId),
      isPrimary: true,
      visibility: input.visibility ?? LocationVisibility.private,
    },
  });
}
export async function getPrimaryLocation(entityType: string, entityId: string) {
  return prisma.location.findUnique({
    where: {
      entityType_entityId_isPrimary: {
        entityType,
        entityId,
        isPrimary: true,
      },
    },
  });
}
