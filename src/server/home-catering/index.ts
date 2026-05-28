import {
  HomeCateringProfileStatus,
  HomeCateringVerificationStatus,
  OrganizationType,
  Prisma,
  SellerType,
  type PlatformRole,
  type UserStatus,
} from "@prisma/client";
import { assertCountryAccess, assertPlatformRole, hasPlatformRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  homeCateringAdminStatusSchema,
  homeCateringProfileSchema,
} from "@/lib/validation/home-catering";
import { createAuditEvent } from "@/server/audit";
import { getSellerVerificationGate } from "@/server/seller-verification-gates";
import { assertStorageFileBelongsToOrganization } from "@/server/storage/storage-images";

const CATERING_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];
const CATERING_READ_ADMIN_ROLES: PlatformRole[] = [...CATERING_ADMIN_ROLES, "auditor"];

const homeCateringDetailArgs = Prisma.validator<Prisma.HomeCateringProfileDefaultArgs>()({
  include: {
    organization: { select: { id: true, name: true, organizationType: true, countryCode: true, currencyCode: true } },
  },
});

export type HomeCateringProfileDetail = Prisma.HomeCateringProfileGetPayload<typeof homeCateringDetailArgs>;

type AdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

function asJsonArray(items: string[]) {
  return items as Prisma.InputJsonValue;
}

function cleanSlug(value: string) {
  return slugify(value).slice(0, 120);
}

export async function canAccessHomeCatering(params: {
  organizationId: string | null;
  platformRole?: PlatformRole | null;
}) {
  if (hasPlatformRole(params.platformRole, ["platform_owner", "platform_admin", "support_admin"])) {
    return true;
  }
  return isFeatureEnabled("home_catering", params.organizationId);
}

export function isHomeCateringBusiness(organizationType: string) {
  return organizationType === OrganizationType.home_catering;
}

export async function getHomeCateringProfileForOrganization(organizationId: string) {
  return prisma.homeCateringProfile.findUnique({
    where: { organizationId },
    ...homeCateringDetailArgs,
  });
}

export async function createEmptyHomeCateringProfile(params: {
  organizationId: string;
  countryCode: string;
  displayName: string;
  actorUserId: string;
}) {
  const existing = await prisma.homeCateringProfile.findUnique({ where: { organizationId: params.organizationId } });
  if (existing) return existing;

  const profile = await prisma.homeCateringProfile.create({
    data: {
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      displayName: params.displayName,
      slug: `${cleanSlug(params.displayName)}-${Math.random().toString(36).slice(2, 8)}`,
      cuisineSpecialtiesJson: [],
      languagesJson: [],
      operationType: "home_caterer",
      acceptsPickup: true,
      acceptsDelivery: false,
      acceptsPreorders: true,
      status: "draft",
      verificationStatus: "unverified",
      isPublic: false,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "home_catering_profile.created",
    targetType: "home_catering_profile",
    targetId: profile.id,
    details: { displayName: profile.displayName },
  });

  return profile;
}

export async function upsertHomeCateringProfile(params: {
  organizationId: string;
  countryCode: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = homeCateringProfileSchema.parse(params.input);
  await Promise.all([
    assertStorageFileBelongsToOrganization(parsed.profilePhotoFileId, params.organizationId),
    assertStorageFileBelongsToOrganization(parsed.coverPhotoFileId, params.organizationId),
  ]);
  const existing = await prisma.homeCateringProfile.findUnique({
    where: { organizationId: params.organizationId },
    select: { id: true, slug: true, status: true, verificationStatus: true },
  });
  const slug = existing?.slug ?? `${cleanSlug(parsed.displayName)}-${Math.random().toString(36).slice(2, 8)}`;
  const verificationStatus = parsed.submitForVerification
    ? HomeCateringVerificationStatus.pending
    : (existing?.verificationStatus ?? HomeCateringVerificationStatus.unverified);

  const profile = await prisma.homeCateringProfile.upsert({
    where: { organizationId: params.organizationId },
    update: {
      displayName: parsed.displayName,
      ownerName: parsed.ownerName ?? null,
      bio: parsed.bio ?? null,
      operationType: parsed.operationType,
      restaurantName: parsed.operationType === "restaurant_caterer" ? parsed.restaurantName ?? null : null,
      restaurantAddress: parsed.operationType === "restaurant_caterer" ? parsed.restaurantAddress ?? null : null,
      restaurantLicense: parsed.operationType === "restaurant_caterer" ? parsed.restaurantLicense ?? null : null,
      profilePhotoUrl: parsed.profilePhotoUrl ?? null,
      coverPhotoUrl: parsed.coverPhotoUrl ?? null,
      profilePhotoFileId: parsed.profilePhotoFileId ?? null,
      coverPhotoFileId: parsed.coverPhotoFileId ?? null,
      cuisineSpecialtiesJson: asJsonArray(parsed.cuisineSpecialties),
      languagesJson: asJsonArray(parsed.languages),
      serviceAreaText: parsed.serviceAreaText ?? null,
      city: parsed.city ?? null,
      region: parsed.region ?? null,
      postalCode: parsed.postalCode ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      acceptsPickup: parsed.acceptsPickup,
      acceptsDelivery: parsed.acceptsDelivery,
      acceptsPreorders: parsed.acceptsPreorders,
      minimumNoticeHours: parsed.minimumNoticeHours ?? null,
      ...(parsed.submitForVerification ? { verificationStatus } : {}),
    },
    create: {
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      displayName: parsed.displayName,
      slug,
      ownerName: parsed.ownerName ?? null,
      bio: parsed.bio ?? null,
      operationType: parsed.operationType,
      restaurantName: parsed.operationType === "restaurant_caterer" ? parsed.restaurantName ?? null : null,
      restaurantAddress: parsed.operationType === "restaurant_caterer" ? parsed.restaurantAddress ?? null : null,
      restaurantLicense: parsed.operationType === "restaurant_caterer" ? parsed.restaurantLicense ?? null : null,
      status: "draft",
      verificationStatus,
      profilePhotoUrl: parsed.profilePhotoUrl ?? null,
      coverPhotoUrl: parsed.coverPhotoUrl ?? null,
      profilePhotoFileId: parsed.profilePhotoFileId ?? null,
      coverPhotoFileId: parsed.coverPhotoFileId ?? null,
      cuisineSpecialtiesJson: asJsonArray(parsed.cuisineSpecialties),
      languagesJson: asJsonArray(parsed.languages),
      serviceAreaText: parsed.serviceAreaText ?? null,
      city: parsed.city ?? null,
      region: parsed.region ?? null,
      postalCode: parsed.postalCode ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      acceptsPickup: parsed.acceptsPickup,
      acceptsDelivery: parsed.acceptsDelivery,
      acceptsPreorders: parsed.acceptsPreorders,
      minimumNoticeHours: parsed.minimumNoticeHours ?? null,
      isPublic: false,
    },
  });

  const action = parsed.submitForVerification
    ? "home_catering_profile.submitted_for_verification"
    : existing
      ? "home_catering_profile.updated"
      : "home_catering_profile.created";

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action,
    targetType: "home_catering_profile",
    targetId: profile.id,
    details: { displayName: profile.displayName, verificationStatus: profile.verificationStatus },
  });

  return profile;
}

export async function pauseHomeCateringProfile(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  paused: boolean;
}) {
  const existing = await getHomeCateringProfileForOrganization(params.organizationId);
  if (!existing) throw new Error("Home catering profile not found.");

  const profile = await prisma.homeCateringProfile.update({
    where: { id: existing.id },
    data: {
      status: params.paused ? "paused" : "active",
      isPublic: !params.paused && existing.verificationStatus === "verified",
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: params.paused ? "home_catering_profile.paused" : "home_catering_profile.activated",
    targetType: "home_catering_profile",
    targetId: profile.id,
    details: { status: profile.status },
  });

  return profile;
}

export async function listPublicHomeCateringProfiles(filters: {
  organizationId: string | null;
  city?: string;
  cuisine?: string;
  pickup?: boolean;
  delivery?: boolean;
  preorder?: boolean;
}) {
  const enabled = await canAccessHomeCatering({ organizationId: filters.organizationId });
  if (!enabled) return [];

  const profiles = await prisma.homeCateringProfile.findMany({
    where: {
      status: "active",
      isPublic: true,
      ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}),
      ...(filters.pickup ? { acceptsPickup: true } : {}),
      ...(filters.delivery ? { acceptsDelivery: true } : {}),
      ...(filters.preorder ? { acceptsPreorders: true } : {}),
    },
    include: { organization: { select: { name: true, countryCode: true } } },
    orderBy: [{ verificationStatus: "desc" }, { displayName: "asc" }],
  });

  const visibleProfiles = [];
  for (const profile of profiles) {
    const gate = await getSellerVerificationGate({
      organizationId: profile.organizationId,
      sellerType: SellerType.home_catering,
      countryCode: profile.countryCode,
      region: profile.region,
      capability: "public_profile",
    });
    if (gate.allowed) visibleProfiles.push(profile);
  }

  if (!filters.cuisine) return visibleProfiles;
  const cuisine = filters.cuisine.toLowerCase();
  return visibleProfiles.filter((profile) =>
    Array.isArray(profile.cuisineSpecialtiesJson)
      ? profile.cuisineSpecialtiesJson.some((item) => String(item).toLowerCase().includes(cuisine))
      : false,
  );
}

export async function getPublicHomeCateringProfile(slug: string, organizationId: string | null) {
  const enabled = await canAccessHomeCatering({ organizationId });
  if (!enabled) return null;

  const profile = await prisma.homeCateringProfile.findFirst({
    where: { slug, status: "active", isPublic: true },
    ...homeCateringDetailArgs,
  });
  if (!profile) return null;
  const gate = await getSellerVerificationGate({
    organizationId: profile.organizationId,
    sellerType: SellerType.home_catering,
    countryCode: profile.countryCode,
    region: profile.region,
    capability: "public_profile",
  });
  return gate.allowed ? profile : null;
}

export async function listAdminHomeCateringProfiles(
  session: AdminSession,
  filters: { countryCode?: string; status?: string; verificationStatus?: string },
) {
  assertPlatformRole(session.user.platformRole, CATERING_READ_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) assertCountryAccess(session, filters.countryCode);

  return prisma.homeCateringProfile.findMany({
    where: {
      countryCode: isCountryManager
        ? filters.countryCode || { in: assignedCountries }
        : filters.countryCode || undefined,
      status: filters.status ? (filters.status as HomeCateringProfileStatus) : undefined,
      verificationStatus: filters.verificationStatus
        ? (filters.verificationStatus as HomeCateringVerificationStatus)
        : undefined,
    },
    include: { organization: { select: { id: true, name: true, organizationType: true, countryCode: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAdminHomeCateringProfile(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, CATERING_READ_ADMIN_ROLES);
  const profile = await prisma.homeCateringProfile.findUnique({ where: { id }, ...homeCateringDetailArgs });
  if (!profile) throw new Error("Home catering profile not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, profile.countryCode);
  return profile;
}

export async function updateAdminHomeCateringProfileStatus(params: {
  session: AdminSession;
  profileId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, CATERING_ADMIN_ROLES);
  const parsed = homeCateringAdminStatusSchema.parse(params.input);
  const existing = await getAdminHomeCateringProfile(params.session, params.profileId);

  const nextStatus = parsed.status ?? existing.status;
  const nextVerification = parsed.verificationStatus ?? existing.verificationStatus;
  const profile = await prisma.homeCateringProfile.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      verificationStatus: nextVerification,
      isPublic: parsed.isPublic ?? (nextStatus === "active" && nextVerification === "verified"),
      adminNotes: parsed.adminNotes ?? existing.adminNotes,
    },
  });

  const action =
    nextVerification === "verified"
      ? "home_catering_profile.verified"
      : nextVerification === "rejected"
        ? "home_catering_profile.rejected"
        : nextStatus === "suspended"
          ? "home_catering_profile.suspended"
          : nextStatus === "active"
            ? "home_catering_profile.activated"
            : "home_catering_profile.updated";

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action,
    targetType: "home_catering_profile",
    targetId: existing.id,
    details: {
      oldStatus: existing.status,
      newStatus: profile.status,
      oldVerificationStatus: existing.verificationStatus,
      newVerificationStatus: profile.verificationStatus,
    },
  });

  return profile;
}
