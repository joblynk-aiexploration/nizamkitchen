import {
  ChefProfileStatus,
  ChefVerificationStatus,
  OrganizationType,
  Prisma,
  type ChefServiceType,
  type PlatformRole,
  type UserStatus,
} from "@prisma/client";
import { assertCountryAccess, assertPlatformRole, hasPlatformRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  chefAvailabilitySchema,
  chefProfileAdminStatusSchema,
  chefProfileSchema,
  chefReviewAdminSchema,
  chefReviewSchema,
  chefServiceSchema,
  chefSpecialtySchema,
} from "@/lib/validation/chefs";
import { createAuditEvent } from "@/server/audit";
import { createNotification } from "@/server/notifications/notification-service";
import { createHomeChefRequest } from "@/server/home-chef";
import { assertStorageFileBelongsToOrganization } from "@/server/storage/storage-images";

const CHEF_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];
const CHEF_READ_ADMIN_ROLES: PlatformRole[] = [...CHEF_ADMIN_ROLES, "auditor"];

const chefProfileDetailArgs = Prisma.validator<Prisma.ChefProfileDefaultArgs>()({
  include: {
    organization: { select: { id: true, name: true, organizationType: true, countryCode: true, currencyCode: true } },
    services: { orderBy: { createdAt: "asc" } },
    specialtyRecipes: { include: { recipe: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: "asc" } },
    availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    reviews: { orderBy: { createdAt: "desc" }, take: 10 },
    verificationDocuments: { orderBy: { createdAt: "desc" } },
  },
});

export type ChefProfileDetail = Prisma.ChefProfileGetPayload<typeof chefProfileDetailArgs>;

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

export async function canAccessChefMarketplace(params: {
  organizationId: string | null;
  platformRole?: PlatformRole | null;
}) {
  if (hasPlatformRole(params.platformRole, ["platform_owner", "platform_admin", "support_admin"])) {
    return true;
  }
  return isFeatureEnabled("home_chefs", params.organizationId);
}

export function isChefBusiness(organizationType: string) {
  return organizationType === OrganizationType.chef_business;
}

export async function getChefProfileForOrganization(organizationId: string) {
  return prisma.chefProfile.findUnique({
    where: { organizationId },
    ...chefProfileDetailArgs,
  });
}

export async function listPublicChefProfiles(filters: {
  organizationId: string | null;
  city?: string;
  region?: string;
  specialty?: string;
  serviceType?: string;
  verifiedOnly?: boolean;
}) {
  const enabled = await canAccessChefMarketplace({ organizationId: filters.organizationId });
  if (!enabled) return prisma.chefProfile.findMany({ where: { id: "__disabled__" }, include: { organization: { select: { name: true, countryCode: true } }, services: true, specialtyRecipes: true, availability: true } });
  const serviceType = filters.serviceType as ChefServiceType | undefined;

  return prisma.chefProfile.findMany({
    where: {
      status: "active",
      isPublic: true,
      ...(filters.verifiedOnly ? { verificationStatus: "verified" } : {}),
      ...(filters.city ? { baseCity: { contains: filters.city, mode: "insensitive" } } : {}),
      ...(filters.region ? { baseRegion: { contains: filters.region, mode: "insensitive" } } : {}),
      ...(serviceType ? { services: { some: { serviceType, isActive: true } } } : {}),
      ...(filters.specialty
        ? {
            OR: [
              { specialtyRecipes: { some: { dishName: { contains: filters.specialty, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      organization: { select: { name: true, countryCode: true } },
      services: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      specialtyRecipes: { orderBy: { createdAt: "asc" }, take: 5 },
      availability: { where: { isAvailable: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
    orderBy: [{ verificationStatus: "desc" }, { displayName: "asc" }],
  });
}

export async function getPublicChefProfile(slug: string, organizationId: string | null) {
  const enabled = await canAccessChefMarketplace({ organizationId });
  if (!enabled) return null;

  return prisma.chefProfile.findFirst({
    where: {
      slug,
      status: "active",
      isPublic: true,
    },
    ...chefProfileDetailArgs,
  });
}

export async function upsertChefProfile(params: {
  organizationId: string;
  countryCode: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = chefProfileSchema.parse(params.input);
  await Promise.all([
    assertStorageFileBelongsToOrganization(parsed.profilePhotoFileId, params.organizationId),
    assertStorageFileBelongsToOrganization(parsed.coverPhotoFileId, params.organizationId),
  ]);
  const existing = await prisma.chefProfile.findUnique({
    where: { organizationId: params.organizationId },
    select: { id: true, slug: true, status: true },
  });
  const slug = existing?.slug ?? cleanSlug(parsed.displayName);
  const verificationStatus = parsed.submitForVerification
    ? ChefVerificationStatus.pending
    : ChefVerificationStatus.unverified;

  const profile = await prisma.chefProfile.upsert({
    where: { organizationId: params.organizationId },
    update: {
      displayName: parsed.displayName,
      bio: parsed.bio,
      profilePhotoUrl: parsed.profilePhotoUrl,
      profilePhotoFileId: parsed.profilePhotoFileId ?? null,
      coverPhotoFileId: parsed.coverPhotoFileId ?? null,
      languages: asJsonArray(parsed.languages),
      specialties: asJsonArray(parsed.specialties),
      yearsExperience: parsed.yearsExperience ?? null,
      serviceRadiusKm: parsed.serviceRadiusKm ?? null,
      baseCity: parsed.baseCity ?? null,
      baseRegion: parsed.baseRegion ?? null,
      postalCode: parsed.postalCode ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      ...(parsed.submitForVerification ? { verificationStatus } : {}),
    },
    create: {
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      displayName: parsed.displayName,
      slug,
      bio: parsed.bio,
      status: "draft",
      verificationStatus,
      profilePhotoUrl: parsed.profilePhotoUrl,
      profilePhotoFileId: parsed.profilePhotoFileId ?? null,
      coverPhotoFileId: parsed.coverPhotoFileId ?? null,
      languages: asJsonArray(parsed.languages),
      specialties: asJsonArray(parsed.specialties),
      yearsExperience: parsed.yearsExperience ?? null,
      serviceRadiusKm: parsed.serviceRadiusKm ?? null,
      baseCity: parsed.baseCity ?? null,
      baseRegion: parsed.baseRegion ?? null,
      postalCode: parsed.postalCode ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      isPublic: false,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: existing ? "chef_profile.updated" : "chef_profile.created",
    targetType: "chef_profile",
    targetId: profile.id,
    details: { displayName: profile.displayName, verificationStatus: profile.verificationStatus },
  });
  return profile;
}

export async function upsertChefService(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = chefServiceSchema.parse(params.input);
  const profile = await getChefProfileForOrganization(params.organizationId);
  if (!profile) throw new Error("Create a chef profile before adding services.");

  const existing = parsed.serviceId
    ? await prisma.chefService.findFirst({ where: { id: parsed.serviceId, chefProfile: { organizationId: params.organizationId } } })
    : null;

  const service = existing
    ? await prisma.chefService.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          description: parsed.description ?? null,
          serviceType: parsed.serviceType,
          basePriceAmount: parsed.basePriceAmount ?? null,
          currencyCode: parsed.currencyCode,
          priceUnit: parsed.priceUnit,
          minGuests: parsed.minGuests ?? null,
          maxGuests: parsed.maxGuests ?? null,
          isActive: parsed.isActive,
        },
      })
    : await prisma.chefService.create({
        data: {
          chefProfileId: profile.id,
          name: parsed.name,
          description: parsed.description ?? null,
          serviceType: parsed.serviceType,
          basePriceAmount: parsed.basePriceAmount ?? null,
          currencyCode: parsed.currencyCode,
          priceUnit: parsed.priceUnit,
          minGuests: parsed.minGuests ?? null,
          maxGuests: parsed.maxGuests ?? null,
          isActive: parsed.isActive,
        },
      });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: existing ? "chef_service.updated" : "chef_service.created",
    targetType: "chef_service",
    targetId: service.id,
    details: { name: service.name, serviceType: service.serviceType },
  });

  return service;
}

export async function addChefSpecialty(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = chefSpecialtySchema.parse(params.input);
  const profile = await getChefProfileForOrganization(params.organizationId);
  if (!profile) throw new Error("Create a chef profile before adding specialties.");

  const specialty = await prisma.chefSpecialtyRecipe.create({
    data: {
      chefProfileId: profile.id,
      recipeId: parsed.recipeId ?? null,
      dishName: parsed.dishName,
      notes: parsed.notes ?? null,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "chef_profile.updated",
    targetType: "chef_profile",
    targetId: profile.id,
    details: { specialtyAdded: parsed.dishName },
  });

  return specialty;
}

export async function addChefVerificationDocument(params: {
  organizationId: string;
  countryCode: string;
  actorUserId: string;
  documentType: string;
  fileId: string | null;
}) {
  const profile = await getChefProfileForOrganization(params.organizationId);
  if (!profile) throw new Error("Create a chef profile before uploading verification documents.");
  await assertStorageFileBelongsToOrganization(params.fileId, params.organizationId);
  if (!params.fileId) throw new Error("Verification document file is required.");

  const document = await prisma.chefVerificationDocument.create({
    data: {
      chefProfileId: profile.id,
      documentType: params.documentType.trim() || "verification_document",
      fileId: params.fileId,
      status: "pending",
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "verification_document.uploaded",
    targetType: "chef_verification_document",
    targetId: document.id,
  });

  return document;
}

export async function upsertChefAvailability(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = chefAvailabilitySchema.parse(params.input);
  const profile = await getChefProfileForOrganization(params.organizationId);
  if (!profile) throw new Error("Create a chef profile before setting availability.");

  const existing = await prisma.chefAvailability.findFirst({
    where: { chefProfileId: profile.id, dayOfWeek: parsed.dayOfWeek },
  });
  const availability = existing
    ? await prisma.chefAvailability.update({
        where: { id: existing.id },
        data: {
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          isAvailable: parsed.isAvailable,
        },
      })
    : await prisma.chefAvailability.create({
        data: {
          chefProfileId: profile.id,
          dayOfWeek: parsed.dayOfWeek,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          isAvailable: parsed.isAvailable,
        },
      });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "chef_availability.updated",
    targetType: "chef_availability",
    targetId: availability.id,
    details: { dayOfWeek: parsed.dayOfWeek, isAvailable: parsed.isAvailable },
  });

  return availability;
}

export async function pauseChefProfile(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  paused: boolean;
}) {
  const existing = await getChefProfileForOrganization(params.organizationId);
  if (!existing) throw new Error("Chef profile not found.");
  const profile = await prisma.chefProfile.update({
    where: { id: existing.id },
    data: { status: params.paused ? "paused" : "active", isPublic: !params.paused && existing.verificationStatus === "verified" },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: params.paused ? "chef_profile.paused" : "chef_profile.updated",
    targetType: "chef_profile",
    targetId: profile.id,
    details: { status: profile.status },
  });

  return profile;
}

export async function createReview(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = chefReviewSchema.parse(params.input);
  const profile = await prisma.chefProfile.findFirst({ where: { id: parsed.chefProfileId, status: "active", isPublic: true } });
  if (!profile) throw new Error("Chef profile is not available for review.");

  const review = await prisma.chefReview.create({
    data: {
      chefProfileId: profile.id,
      organizationId: params.organizationId,
      homeChefRequestId: parsed.homeChefRequestId ?? null,
      rating: parsed.rating,
      comment: parsed.comment ?? null,
      status: "pending",
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "chef_review.created",
    targetType: "chef_review",
    targetId: review.id,
    details: { chefProfileId: profile.id, rating: parsed.rating },
  });

  return review;
}

export async function requestSpecificChef(params: {
  householdOrganizationId: string;
  householdCountryCode: string;
  householdCurrencyCode: string;
  actorUserId: string;
  chefSlug: string;
  input: unknown;
}) {
  const chef = await getPublicChefProfile(params.chefSlug, params.householdOrganizationId);
  if (!chef) throw new Error("Chef profile is not available.");

  const request = await createHomeChefRequest({
    organizationId: params.householdOrganizationId,
    countryCode: params.householdCountryCode,
    createdById: params.actorUserId,
    defaultCurrencyCode: params.householdCurrencyCode,
    input: { ...(typeof params.input === "object" && params.input !== null ? params.input : {}), submit: true },
  });

  const assigned = await prisma.homeChefRequest.update({
    where: { id: request.id },
    data: {
      assignedChefOrganizationId: chef.organizationId,
      status: "reviewing",
      statusHistory: {
        create: {
          oldStatus: request.status,
          newStatus: "reviewing",
          changedById: params.actorUserId,
          note: `Requested specific chef: ${chef.displayName}.`,
        },
      },
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.householdOrganizationId,
    countryCode: params.householdCountryCode,
    action: "home_chef_request.assigned",
    targetType: "home_chef_request",
    targetId: assigned.id,
    details: { assignedChefOrganizationId: chef.organizationId, chefProfileId: chef.id },
  });

  return assigned;
}

export async function listAdminChefProfiles(
  session: AdminSession,
  filters: { countryCode?: string; status?: string; verificationStatus?: string },
) {
  assertPlatformRole(session.user.platformRole, CHEF_READ_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) assertCountryAccess(session, filters.countryCode);

  return prisma.chefProfile.findMany({
    where: {
      countryCode: isCountryManager
        ? filters.countryCode || { in: assignedCountries }
        : filters.countryCode || undefined,
      status: filters.status ? (filters.status as ChefProfileStatus) : undefined,
      verificationStatus: filters.verificationStatus
        ? (filters.verificationStatus as ChefVerificationStatus)
        : undefined,
    },
    include: {
      organization: { select: { id: true, name: true, organizationType: true, countryCode: true } },
      services: true,
      _count: { select: { reviews: true, specialtyRecipes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAdminChefProfile(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, CHEF_READ_ADMIN_ROLES);
  const profile = await prisma.chefProfile.findUnique({
    where: { id },
    ...chefProfileDetailArgs,
  });
  if (!profile) throw new Error("Chef profile not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, profile.countryCode);
  return profile;
}

export async function updateAdminChefProfileStatus(params: {
  session: AdminSession;
  chefProfileId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, CHEF_ADMIN_ROLES);
  const parsed = chefProfileAdminStatusSchema.parse(params.input);
  const existing = await getAdminChefProfile(params.session, params.chefProfileId);

  const nextStatus = parsed.status ?? existing.status;
  const nextVerification = parsed.verificationStatus ?? existing.verificationStatus;
  const profile = await prisma.chefProfile.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      verificationStatus: nextVerification,
      isPublic: parsed.isPublic ?? (nextStatus === "active" && nextVerification === "verified"),
    },
  });

  const action =
    nextVerification === "verified"
      ? "chef_profile.verified"
      : nextStatus === "active"
        ? "chef_profile.approved"
        : nextStatus === "suspended"
          ? "chef_profile.suspended"
          : "chef_profile.updated";

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action,
    targetType: "chef_profile",
    targetId: existing.id,
    details: {
      oldStatus: existing.status,
      newStatus: profile.status,
      oldVerificationStatus: existing.verificationStatus,
      newVerificationStatus: profile.verificationStatus,
    },
  });

  if (action === "chef_profile.verified" || action === "chef_profile.approved" || action === "chef_profile.suspended") {
    await createNotification({
      organizationId: existing.organizationId,
      countryCode: existing.countryCode,
      type: action,
      title: action === "chef_profile.suspended" ? "Chef profile needs attention" : "Chef profile approved",
      body:
        action === "chef_profile.suspended"
          ? "Your chef profile was suspended by platform support."
          : "Your chef profile is approved for marketplace visibility when public listing is enabled.",
      actionUrl: "/chef/profile",
      priority: action === "chef_profile.suspended" ? "urgent" : "high",
      emailTemplateKey: action === "chef_profile.suspended" ? "chef_profile_suspended" : "chef_profile_approved",
      preferenceKey: "homeChefUpdates",
    });
  }

  return profile;
}

export async function updateAdminChefReviewStatus(params: {
  session: AdminSession;
  reviewId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, CHEF_ADMIN_ROLES);
  const parsed = chefReviewAdminSchema.parse(params.input);
  const review = await prisma.chefReview.update({
    where: { id: params.reviewId },
    data: { status: parsed.status },
    include: { chefProfile: true },
  });
  if (params.session.user.platformRole === "country_manager") {
    assertCountryAccess(params.session, review.chefProfile.countryCode);
  }
  return review;
}
