import {
  FoodSafetyCertificateStatus,
  SellerPermitStatus,
  OrganizationType,
  SellerRequirementType,
  SellerTrialReviewStatus,
  SellerType,
  SellerVerificationItemStatus,
  SellerVerificationLevel,
  SellerVerificationStatus,
  type PlatformRole,
  type Prisma,
  type UserStatus,
} from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  foodSafetyCertificateReviewSchema,
  foodSafetyCertificateSchema,
  kitchenPhotoSchema,
  kitchenSafetyReviewSchema,
  sellerAttestationSchema,
  sellerPermitReviewSchema,
  sellerPermitSchema,
  sellerRequirementSchema,
  sellerTrialReviewSchema,
  sellerVerificationDocumentSchema,
  sellerVerificationItemReviewSchema,
  sellerVerificationProfileReviewSchema,
} from "@/lib/validation/seller-verification";
import { createAuditEvent } from "@/server/audit";
import { createNotification } from "@/server/notifications/notification-service";
import { assertStorageFileBelongsToOrganization } from "@/server/storage/storage-images";

type SellerSession = {
  user: { id: string; email?: string; status: UserStatus; platformRole: PlatformRole | null };
  activeOrganization?: { id: string; countryCode: string; organizationType: string; name?: string } | null;
  activeMembership?: { role: string; status: string } | null;
  countryAssignments?: Array<{ countryCode: string }>;
};

type AdminSession = {
  user: { id: string; email?: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments?: Array<{ countryCode: string }>;
};

const ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];
const MUTATION_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager"];
const SELLER_OWNER_ROLES = new Set(["org_owner", "org_admin", "chef_owner", "restaurant_owner", "grocery_partner_admin"]);

const verificationProfileInclude = {
  organization: { select: { id: true, name: true, organizationType: true, countryCode: true, currencyCode: true } },
  reviewedBy: { select: { id: true, fullName: true, email: true } },
  items: { include: { requirement: true, reviewedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "desc" } },
  foodSafetyCertificates: { orderBy: { createdAt: "desc" }, include: { reviewedBy: { select: { id: true, fullName: true } } } },
  permits: { orderBy: { createdAt: "desc" }, include: { reviewedBy: { select: { id: true, fullName: true } } } },
  attestations: { orderBy: { acceptedAt: "desc" } },
  backgroundChecks: { orderBy: { createdAt: "desc" } },
  kitchenReviews: { include: { photos: true, reviewedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "desc" } },
  trialReviews: { include: { reviewedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.SellerVerificationProfileInclude;

export function sellerTypeForOrganizationType(organizationType: string): SellerType | null {
  if (organizationType === OrganizationType.chef_business) return SellerType.chef_business;
  if (organizationType === OrganizationType.home_catering) return SellerType.home_catering;
  if (organizationType === OrganizationType.restaurant) return SellerType.restaurant;
  return null;
}

export function assertSellerCanManageVerification(session: SellerSession) {
  const sellerType = session.activeOrganization ? sellerTypeForOrganizationType(session.activeOrganization.organizationType) : null;
  if (!sellerType || !session.activeOrganization || !session.activeMembership || !SELLER_OWNER_ROLES.has(session.activeMembership.role)) {
    throw new Error("Seller verification is available only to seller organization owners and admins.");
  }
  return { sellerType, organization: session.activeOrganization };
}

export async function getOrCreateSellerVerificationProfile(session: SellerSession) {
  const { sellerType, organization } = assertSellerCanManageVerification(session);
  const existing = await prisma.sellerVerificationProfile.findUnique({
    where: { organizationId: organization.id },
    include: verificationProfileInclude,
  });
  if (existing) return existing;

  const profile = await prisma.sellerVerificationProfile.create({
    data: {
      organizationId: organization.id,
      countryCode: organization.countryCode,
      sellerType,
      status: SellerVerificationStatus.in_progress,
      verificationLevel: SellerVerificationLevel.unverified,
    },
    include: verificationProfileInclude,
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: organization.id,
    countryCode: organization.countryCode,
    action: "seller_verification_profile.created",
    targetType: "seller_verification_profile",
    targetId: profile.id,
  });
  return profile;
}

export async function listRequirementsForSeller(params: { countryCode: string; region?: string | null; sellerType: SellerType }) {
  const configured = await prisma.sellerVerificationRequirement.findMany({
    where: {
      sellerType: params.sellerType,
      isActive: true,
      OR: [
        { countryCode: null, region: null },
        { countryCode: params.countryCode, region: null },
        ...(params.region ? [{ countryCode: params.countryCode, region: params.region }] : []),
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return configured.length ? configured : defaultRequirements(params.sellerType);
}

export async function listAdminVerificationProfiles(session: AdminSession, filters: { countryCode?: string; sellerType?: string; status?: string } = {}) {
  assertPlatformRole(session.user.platformRole, ADMIN_ROLES);
  const where: Prisma.SellerVerificationProfileWhereInput = {
    ...(filters.countryCode ? { countryCode: filters.countryCode.toUpperCase() } : {}),
    ...(filters.sellerType ? { sellerType: filters.sellerType as SellerType } : {}),
    ...(filters.status ? { status: filters.status as SellerVerificationStatus } : {}),
  };
  if (session.user.platformRole === "country_manager") {
    const assigned = session.countryAssignments?.map((assignment) => assignment.countryCode) ?? [];
    const requested = filters.countryCode?.toUpperCase();
    where.countryCode = requested && assigned.includes(requested) ? requested : { in: assigned };
  }
  return prisma.sellerVerificationProfile.findMany({
    where,
    include: verificationProfileInclude,
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
}

export async function getAdminVerificationProfile(session: AdminSession, profileId: string) {
  assertPlatformRole(session.user.platformRole, ADMIN_ROLES);
  const profile = await prisma.sellerVerificationProfile.findUnique({ where: { id: profileId }, include: verificationProfileInclude });
  if (!profile) throw new Error("Verification profile not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, profile.countryCode);
  return profile;
}

export async function upsertSellerVerificationRequirement(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MUTATION_ROLES);
  const parsed = sellerRequirementSchema.parse(input);
  if (session.user.platformRole === "country_manager" && parsed.countryCode) assertCountryAccess(session as never, parsed.countryCode);
  const data = {
    countryCode: parsed.countryCode?.toUpperCase() ?? null,
    region: parsed.region ?? null,
    sellerType: parsed.sellerType,
    requirementType: parsed.requirementType,
    title: parsed.title,
    description: parsed.description ?? null,
    isRequired: parsed.isRequired,
    provider: parsed.provider,
    validityDays: parsed.validityDays ?? null,
    sortOrder: parsed.sortOrder,
    isActive: parsed.isActive,
  };
  const requirement = parsed.requirementId
    ? await prisma.sellerVerificationRequirement.update({ where: { id: parsed.requirementId }, data })
    : await prisma.sellerVerificationRequirement.create({ data });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: requirement.countryCode,
    action: parsed.requirementId ? "seller_verification_requirement.updated" : "seller_verification_requirement.created",
    targetType: "seller_verification_requirement",
    targetId: requirement.id,
    details: { sellerType: requirement.sellerType, requirementType: requirement.requirementType, isRequired: requirement.isRequired },
  });
  return requirement;
}

export async function submitSellerVerificationDocument(session: SellerSession, input: unknown) {
  const parsed = sellerVerificationDocumentSchema.parse(input);
  const profile = await getOrCreateSellerVerificationProfile(session);
  await assertStorageFileBelongsToOrganization(parsed.documentFileId, profile.organizationId);
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  const existing = parsed.requirementId
    ? await prisma.sellerVerificationItem.findFirst({ where: { verificationProfileId: profile.id, requirementId: parsed.requirementId } })
    : await prisma.sellerVerificationItem.findFirst({ where: { verificationProfileId: profile.id, requirementId: null, requirementType: parsed.requirementType } });
  const item = existing
    ? await prisma.sellerVerificationItem.update({
        where: { id: existing.id },
        data: {
          requirementType: parsed.requirementType,
          documentFileId: parsed.documentFileId,
          status: SellerVerificationItemStatus.submitted,
          submittedAt: new Date(),
          expiresAt,
          rejectionReason: null,
        },
      })
    : await prisma.sellerVerificationItem.create({
        data: {
          verificationProfileId: profile.id,
          requirementId: parsed.requirementId ?? null,
          requirementType: parsed.requirementType,
          documentFileId: parsed.documentFileId,
          status: SellerVerificationItemStatus.submitted,
          submittedAt: new Date(),
          expiresAt,
        },
      });
  await prisma.sellerVerificationProfile.update({ where: { id: profile.id }, data: { status: SellerVerificationStatus.in_progress } });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: "seller_verification_item.submitted",
    targetType: "seller_verification_item",
    targetId: item.id,
    details: { requirementType: item.requirementType, documentFileId: item.documentFileId },
  });
  return item;
}

export async function submitFoodSafetyCertificate(session: SellerSession, input: unknown) {
  const parsed = foodSafetyCertificateSchema.parse(input);
  const profile = await getOrCreateSellerVerificationProfile(session);
  await assertStorageFileBelongsToOrganization(parsed.fileId, profile.organizationId);
  const certificate = await prisma.foodSafetyCertificate.create({
    data: {
      organizationId: profile.organizationId,
      verificationProfileId: profile.id,
      fileId: parsed.fileId,
      providerName: parsed.providerName ?? null,
      certificateNumber: parsed.certificateNumber ?? null,
      issuedAt: toDate(parsed.issuedAt),
      expiresAt: toDate(parsed.expiresAt),
      countryCode: parsed.countryCode.toUpperCase(),
      region: parsed.region ?? null,
      notes: parsed.notes ?? null,
      status: FoodSafetyCertificateStatus.submitted,
    },
  });
  await upsertVerificationItem(profile.id, "food_handler_certificate", "submitted", parsed.fileId, certificate.expiresAt);
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: "food_safety_certificate.submitted",
    targetType: "food_safety_certificate",
    targetId: certificate.id,
  });
  return certificate;
}

export async function reviewFoodSafetyCertificate(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MUTATION_ROLES);
  const parsed = foodSafetyCertificateReviewSchema.parse(input);
  const existing = await prisma.foodSafetyCertificate.findUnique({ where: { id: parsed.certificateId }, include: { verificationProfile: true } });
  if (!existing) throw new Error("Food safety certificate not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, existing.verificationProfile.countryCode);
  const expiresAt = toDate(parsed.expiresAt) ?? existing.expiresAt;
  const certificate = await prisma.foodSafetyCertificate.update({
    where: { id: existing.id },
    data: { status: parsed.status, expiresAt, reviewedAt: new Date(), reviewedById: session.user.id, rejectionReason: parsed.rejectionReason ?? null },
  });
  await upsertVerificationItem(existing.verificationProfileId, "food_handler_certificate", itemStatusFromDocumentStatus(parsed.status), existing.fileId, expiresAt, parsed.rejectionReason);
  if (parsed.status === "expired") {
    await markProfileExpired(existing.verificationProfileId);
  }
  await notifyVerificationOutcome(existing.organizationId, existing.verificationProfile.countryCode, parsed.status, "Food safety certificate", `/admin/verifications/${existing.verificationProfileId}`);
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.verificationProfile.countryCode,
    action: `food_safety_certificate.${parsed.status}`,
    targetType: "food_safety_certificate",
    targetId: certificate.id,
    details: { status: certificate.status, expiresAt: certificate.expiresAt, rejectionReason: certificate.rejectionReason },
  });
  return certificate;
}

export async function submitSellerPermit(session: SellerSession, input: unknown) {
  const parsed = sellerPermitSchema.parse(input);
  const profile = await getOrCreateSellerVerificationProfile(session);
  await assertStorageFileBelongsToOrganization(parsed.fileId, profile.organizationId);
  const permit = await prisma.sellerPermit.create({
    data: {
      organizationId: profile.organizationId,
      verificationProfileId: profile.id,
      permitType: parsed.permitType,
      fileId: parsed.fileId,
      issuingAuthority: parsed.issuingAuthority ?? null,
      permitNumber: parsed.permitNumber ?? null,
      issuedAt: toDate(parsed.issuedAt),
      expiresAt: toDate(parsed.expiresAt),
      status: SellerPermitStatus.submitted,
    },
  });
  await upsertVerificationItem(profile.id, "local_permit", "submitted", parsed.fileId, permit.expiresAt);
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: "seller_permit.submitted",
    targetType: "seller_permit",
    targetId: permit.id,
    details: { permitType: permit.permitType },
  });
  return permit;
}

export async function reviewSellerPermit(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MUTATION_ROLES);
  const parsed = sellerPermitReviewSchema.parse(input);
  const existing = await prisma.sellerPermit.findUnique({ where: { id: parsed.permitId }, include: { verificationProfile: true } });
  if (!existing) throw new Error("Seller permit not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, existing.verificationProfile.countryCode);
  const expiresAt = toDate(parsed.expiresAt) ?? existing.expiresAt;
  const permit = await prisma.sellerPermit.update({
    where: { id: existing.id },
    data: { status: parsed.status, expiresAt, reviewedAt: new Date(), reviewedById: session.user.id, rejectionReason: parsed.rejectionReason ?? null },
  });
  await upsertVerificationItem(existing.verificationProfileId, "local_permit", itemStatusFromDocumentStatus(parsed.status), existing.fileId, expiresAt, parsed.rejectionReason);
  if (parsed.status === "expired") {
    await markProfileExpired(existing.verificationProfileId);
  }
  await notifyVerificationOutcome(existing.organizationId, existing.verificationProfile.countryCode, parsed.status, "Seller permit", `/admin/verifications/${existing.verificationProfileId}`);
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.verificationProfile.countryCode,
    action: `seller_permit.${parsed.status}`,
    targetType: "seller_permit",
    targetId: permit.id,
    details: { status: permit.status, permitType: permit.permitType, expiresAt: permit.expiresAt },
  });
  return permit;
}

export async function acceptSellerAttestation(session: SellerSession, input: unknown, requestMeta?: { ipAddress?: string | null; userAgent?: string | null }) {
  const parsed = sellerAttestationSchema.parse(input);
  const profile = await getOrCreateSellerVerificationProfile(session);
  const attestation = await prisma.sellerAttestation.create({
    data: {
      organizationId: profile.organizationId,
      verificationProfileId: profile.id,
      attestationType: parsed.attestationType,
      version: parsed.version,
      textSnapshot: parsed.textSnapshot,
      acceptedByUserId: session.user.id,
      ipAddress: requestMeta?.ipAddress ?? null,
      userAgent: requestMeta?.userAgent ?? null,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: parsed.attestationType === "background_check_consent" ? "background_check.consent_collected" : "seller_attestation.accepted",
    targetType: "seller_attestation",
    targetId: attestation.id,
    details: { attestationType: attestation.attestationType, version: attestation.version },
  });
  return attestation;
}

export async function submitKitchenSafetyPhoto(session: SellerSession, input: unknown) {
  const parsed = kitchenPhotoSchema.parse(input);
  const profile = await getOrCreateSellerVerificationProfile(session);
  await assertStorageFileBelongsToOrganization(parsed.fileId, profile.organizationId);
  const existingReview = await prisma.kitchenSafetyReview.findFirst({ where: { verificationProfileId: profile.id }, select: { id: true } });
  const review = existingReview
    ? await prisma.kitchenSafetyReview.update({ where: { id: existingReview.id }, data: { status: "submitted" } })
    : await prisma.kitchenSafetyReview.create({ data: { organizationId: profile.organizationId, verificationProfileId: profile.id, status: "submitted" } });
  const photo = await prisma.kitchenSafetyPhoto.create({
    data: { kitchenSafetyReviewId: review.id, fileId: parsed.fileId, category: parsed.category, caption: parsed.caption ?? null },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: "kitchen_safety_review.submitted",
    targetType: "kitchen_safety_review",
    targetId: review.id,
    details: { photoId: photo.id, category: photo.category },
  });
  return photo;
}

export async function reviewKitchenSafetyChecklist(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MUTATION_ROLES);
  const parsed = kitchenSafetyReviewSchema.parse(input);
  const existing = await prisma.kitchenSafetyReview.findUnique({ where: { id: parsed.reviewId }, include: { verificationProfile: true } });
  if (!existing) throw new Error("Kitchen safety review not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, existing.verificationProfile.countryCode);
  const checklistJson = {
    cleanPrepSurfaces: parsed.cleanPrepSurfaces,
    handwashingSanitation: parsed.handwashingSanitation,
    safeFoodStorage: parsed.safeFoodStorage,
    organizedDryStorage: parsed.organizedDryStorage,
    properPackagingArea: parsed.properPackagingArea,
    noPetsInPrepArea: parsed.noPetsInPrepArea,
  };
  const review = await prisma.kitchenSafetyReview.update({
    where: { id: existing.id },
    data: {
      status: parsed.status,
      cleanlinessScore: parsed.cleanlinessScore,
      storageScore: parsed.storageScore,
      sanitationScore: parsed.sanitationScore,
      packagingScore: parsed.packagingScore,
      checklistJson,
      notes: parsed.notes ?? null,
      reviewedAt: new Date(),
      reviewedById: session.user.id,
    },
  });
  await upsertVerificationItem(existing.verificationProfileId, "kitchen_photos", parsed.status === "approved" ? "approved" : parsed.status === "rejected" ? "rejected" : "submitted", null, null, parsed.status === "rejected" ? parsed.notes : null);
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.verificationProfile.countryCode,
    action: parsed.status === "approved" ? "kitchen_safety_review.approved" : parsed.status === "rejected" ? "kitchen_safety_review.rejected" : "kitchen_safety_review.updated",
    targetType: "kitchen_safety_review",
    targetId: review.id,
    details: { status: review.status, checklistJson },
  });
  return review;
}

export async function upsertSellerTrialReview(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MUTATION_ROLES);
  const parsed = sellerTrialReviewSchema.parse(input);
  const profile = await prisma.sellerVerificationProfile.findUnique({ where: { id: parsed.profileId } });
  if (!profile) throw new Error("Verification profile not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, profile.countryCode);
  const data = {
    organizationId: profile.organizationId,
    verificationProfileId: profile.id,
    status: parsed.status as SellerTrialReviewStatus,
    scheduledAt: toDate(parsed.scheduledAt),
    reviewedById: session.user.id,
    dishName: parsed.dishName ?? null,
    tasteScore: parsed.tasteScore,
    packagingScore: parsed.packagingScore,
    presentationScore: parsed.presentationScore,
    notes: parsed.notes ?? null,
  };
  const review = parsed.trialReviewId
    ? await prisma.sellerTrialReview.update({ where: { id: parsed.trialReviewId }, data })
    : await prisma.sellerTrialReview.create({ data });
  await upsertVerificationItem(profile.id, "trial_taste_test", trialItemStatus(parsed.status), null, null, parsed.status === "rejected" ? parsed.notes : null);
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: `seller_trial_review.${parsed.status}`,
    targetType: "seller_trial_review",
    targetId: review.id,
    details: { status: review.status, dishName: review.dishName },
  });
  return review;
}

export async function submitSellerVerificationForReview(session: SellerSession) {
  const profile = await getOrCreateSellerVerificationProfile(session);
  const updated = await prisma.sellerVerificationProfile.update({
    where: { id: profile.id },
    data: { status: SellerVerificationStatus.submitted, submittedAt: new Date(), rejectionReason: null },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: "seller_verification.submitted",
    targetType: "seller_verification_profile",
    targetId: profile.id,
  });
  return updated;
}

export async function reviewSellerVerificationItem(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MUTATION_ROLES);
  const parsed = sellerVerificationItemReviewSchema.parse(input);
  const existing = await prisma.sellerVerificationItem.findUnique({ where: { id: parsed.itemId }, include: { verificationProfile: true } });
  if (!existing) throw new Error("Verification item not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, existing.verificationProfile.countryCode);
  const item = await prisma.sellerVerificationItem.update({
    where: { id: existing.id },
    data: { status: parsed.status, reviewedAt: new Date(), reviewedById: session.user.id, rejectionReason: parsed.rejectionReason ?? null },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: existing.verificationProfile.organizationId,
    countryCode: existing.verificationProfile.countryCode,
    action: parsed.status === "approved" ? "seller_verification_item.approved" : "seller_verification_item.rejected",
    targetType: "seller_verification_item",
    targetId: item.id,
    details: { status: item.status, rejectionReason: item.rejectionReason },
  });
  return item;
}

export async function reviewSellerVerificationProfile(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MUTATION_ROLES);
  const parsed = sellerVerificationProfileReviewSchema.parse(input);
  const existing = await prisma.sellerVerificationProfile.findUnique({ where: { id: parsed.profileId } });
  if (!existing) throw new Error("Verification profile not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, existing.countryCode);
  const profile = await prisma.sellerVerificationProfile.update({
    where: { id: existing.id },
    data: {
      status: parsed.status,
      verificationLevel: parsed.verificationLevel,
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      rejectionReason: parsed.rejectionReason ?? null,
      adminNotes: parsed.adminNotes ?? null,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: profile.organizationId,
    countryCode: profile.countryCode,
    action: parsed.status === "verified" ? "seller_verification.approved" : parsed.status === "rejected" ? "seller_verification.rejected" : "seller_verification.suspended",
    targetType: "seller_verification_profile",
    targetId: profile.id,
    details: { status: profile.status, verificationLevel: profile.verificationLevel },
  });
  return profile;
}

export async function getPublicSellerVerificationBadge(organizationId: string) {
  const profile = await prisma.sellerVerificationProfile.findUnique({
    where: { organizationId },
    select: { status: true, verificationLevel: true },
  });
  return safeVerificationBadge(profile);
}

export async function getPublicSellerVerificationBadges(organizationId: string) {
  const profile = await prisma.sellerVerificationProfile.findUnique({
    where: { organizationId },
    select: {
      status: true,
      verificationLevel: true,
      foodSafetyCertificates: { select: { status: true } },
      kitchenReviews: { select: { status: true } },
      backgroundChecks: { select: { status: true } },
    },
  });
  return publicVerificationBadges(profile);
}

export function safeVerificationBadge(profile: { status: SellerVerificationStatus; verificationLevel: SellerVerificationLevel } | null) {
  if (!profile || profile.status !== "verified") return { label: "Unverified", tone: "neutral" as const };
  const labels: Record<SellerVerificationLevel, string> = {
    unverified: "Unverified",
    profile_verified: "Profile verified",
    identity_verified: "Identity verified",
    food_safety_verified: "Food safety verified",
    kitchen_reviewed: "Kitchen reviewed",
    background_checked: "Background checked",
    fully_verified: "Fully verified",
  };
  return { label: labels[profile.verificationLevel], tone: "success" as const };
}

export function publicVerificationBadges(profile: {
  status: SellerVerificationStatus;
  verificationLevel: SellerVerificationLevel;
  foodSafetyCertificates?: Array<{ status: FoodSafetyCertificateStatus }>;
  kitchenReviews?: Array<{ status: string }>;
  backgroundChecks?: Array<{ status: string }>;
} | null) {
  if (!profile || profile.status !== "verified") return [safeVerificationBadge(profile)];
  const badges = [safeVerificationBadge(profile)];
  if (profile.foodSafetyCertificates?.some((certificate) => certificate.status === "approved")) badges.push({ label: "Food safety certificate verified", tone: "success" as const });
  if (profile.kitchenReviews?.some((review) => review.status === "approved")) badges.push({ label: "Kitchen reviewed", tone: "success" as const });
  if (profile.backgroundChecks?.some((check) => check.status === "clear")) badges.push({ label: "Background check complete", tone: "success" as const });
  return badges;
}

export async function createVerificationExpiryReminders(asOf = new Date()) {
  const windows = [60, 30, 7, 0] as const;
  const reminders: Array<{ organizationId: string; countryCode: string; title: string; body: string; type: string }> = [];
  const maxDate = addDays(asOf, 60);
  const [certificates, permits] = await Promise.all([
    prisma.foodSafetyCertificate.findMany({ where: { status: "approved", expiresAt: { lte: maxDate } }, include: { verificationProfile: true } }),
    prisma.sellerPermit.findMany({ where: { status: "approved", expiresAt: { lte: maxDate } }, include: { verificationProfile: true } }),
  ]);

  for (const certificate of certificates) {
    if (!certificate.expiresAt) continue;
    const days = daysUntil(asOf, certificate.expiresAt);
    const window = windows.find((value) => days <= value);
    if (window === undefined) continue;
    if (days < 0) {
      await prisma.foodSafetyCertificate.update({ where: { id: certificate.id }, data: { status: "expired" } });
      await markProfileExpired(certificate.verificationProfileId);
    }
    reminders.push({
      organizationId: certificate.organizationId,
      countryCode: certificate.verificationProfile.countryCode,
      type: days < 0 ? "verification_document_expired" : "verification_document_expiring",
      title: days < 0 ? "Food safety certificate expired" : "Food safety certificate expiring",
      body: days < 0 ? "A food safety certificate has expired. Upload a current certificate for review." : `A food safety certificate expires in ${Math.max(days, 0)} days.`,
    });
  }

  for (const permit of permits) {
    if (!permit.expiresAt) continue;
    const days = daysUntil(asOf, permit.expiresAt);
    const window = windows.find((value) => days <= value);
    if (window === undefined) continue;
    if (days < 0) {
      await prisma.sellerPermit.update({ where: { id: permit.id }, data: { status: "expired" } });
      await markProfileExpired(permit.verificationProfileId);
    }
    reminders.push({
      organizationId: permit.organizationId,
      countryCode: permit.verificationProfile.countryCode,
      type: days < 0 ? "verification_document_expired" : "verification_document_expiring",
      title: days < 0 ? "Seller permit expired" : "Seller permit expiring",
      body: days < 0 ? "A seller permit has expired. Upload a current permit for review." : `A seller permit expires in ${Math.max(days, 0)} days.`,
    });
  }

  await Promise.all(reminders.map((reminder) => createNotification({ ...reminder, priority: reminder.type.endsWith("expired") ? "high" : "normal", actionUrl: "/notifications" })));
  return { count: reminders.length };
}

async function upsertVerificationItem(
  verificationProfileId: string,
  requirementType: SellerRequirementType,
  status: SellerVerificationItemStatus,
  documentFileId?: string | null,
  expiresAt?: Date | null,
  rejectionReason?: string | null,
) {
  const existing = await prisma.sellerVerificationItem.findFirst({ where: { verificationProfileId, requirementType } });
  const data = { status, documentFileId: documentFileId ?? undefined, expiresAt: expiresAt ?? undefined, rejectionReason: rejectionReason ?? null, reviewedAt: status === "approved" || status === "rejected" || status === "expired" ? new Date() : undefined };
  return existing
    ? prisma.sellerVerificationItem.update({ where: { id: existing.id }, data })
    : prisma.sellerVerificationItem.create({ data: { verificationProfileId, requirementType, status, documentFileId: documentFileId ?? null, expiresAt: expiresAt ?? null, rejectionReason: rejectionReason ?? null, submittedAt: new Date() } });
}

async function markProfileExpired(profileId: string) {
  await prisma.sellerVerificationProfile.update({
    where: { id: profileId },
    data: { status: SellerVerificationStatus.expired, verificationLevel: SellerVerificationLevel.unverified },
  });
}

function itemStatusFromDocumentStatus(status: "approved" | "rejected" | "expired" | "needs_more_info") {
  if (status === "approved") return SellerVerificationItemStatus.approved;
  if (status === "expired") return SellerVerificationItemStatus.expired;
  return SellerVerificationItemStatus.rejected;
}

function trialItemStatus(status: `${SellerTrialReviewStatus}`) {
  if (status === "approved" || status === "waived" || status === "not_required") return SellerVerificationItemStatus.approved;
  if (status === "rejected") return SellerVerificationItemStatus.rejected;
  return SellerVerificationItemStatus.submitted;
}

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysUntil(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

async function notifyVerificationOutcome(organizationId: string, countryCode: string, status: string, label: string, actionUrl: string) {
  if (status === "approved") {
    await createNotification({ organizationId, countryCode, type: "verification_approved", title: `${label} approved`, body: `${label} was approved by NizamKitchen admin review.`, actionUrl });
  } else if (status === "rejected" || status === "needs_more_info") {
    await createNotification({ organizationId, countryCode, type: "verification_item_rejected", title: `${label} needs attention`, body: `${label} needs more information or was rejected. Check your verification page for details.`, actionUrl, priority: "high" });
  } else if (status === "expired") {
    await createNotification({ organizationId, countryCode, type: "verification_document_expired", title: `${label} expired`, body: `${label} has expired and needs a current replacement.`, actionUrl, priority: "high" });
  }
}

function defaultRequirements(sellerType: SellerType) {
  const common = [
    defaultRequirement(sellerType, "identity", "Identity verification", "Provide identity verification through an approved provider or admin review.", 10),
    defaultRequirement(sellerType, "payout_onboarding", "Payout onboarding", "Complete payout setup before receiving marketplace payments.", 50),
    defaultRequirement(sellerType, "platform_attestation", "Seller responsibility attestation", "Accept platform food safety, tax, and local-law responsibility terms.", 60),
  ];
  if (sellerType === SellerType.restaurant) {
    return [
      defaultRequirement(sellerType, "business_info", "Business information", "Provide business profile details for admin review.", 5),
      defaultRequirement(sellerType, "local_permit", "Local permit or license", "Upload restaurant permit or license documentation.", 20),
      ...common,
    ];
  }
  if (sellerType === SellerType.chef_business) {
    return [
      ...common,
      defaultRequirement(sellerType, "food_handler_certificate", "Food handler certificate", "Upload a current food handler certificate where required.", 20),
      defaultRequirement(sellerType, "background_check", "Background check consent", "Authorize background check review where applicable.", 30),
      defaultRequirement(sellerType, "trial_taste_test", "Trial taste test", "Optional admin-reviewed trial or tasting note.", 80, false),
    ];
  }
  return [
    ...common,
    defaultRequirement(sellerType, "food_handler_certificate", "Food handler certificate", "Upload a current food handler certificate where required.", 20),
    defaultRequirement(sellerType, "local_permit", "Local permit or cottage-food license", "Upload any local permit/license that applies to your region.", 25, false),
    defaultRequirement(sellerType, "kitchen_photos", "Kitchen safety photos", "Upload private photos for kitchen safety review.", 30),
    defaultRequirement(sellerType, "background_check", "Background check consent", "Authorize background check review where applicable.", 40),
  ];
}

function defaultRequirement(sellerType: SellerType, requirementType: `${SellerRequirementType}`, title: string, description: string, sortOrder: number, isRequired = true) {
  return {
    id: `default-${sellerType}-${requirementType}`,
    countryCode: null,
    region: null,
    sellerType,
    requirementType: requirementType as SellerRequirementType,
    title,
    description,
    isRequired,
    provider: "manual" as const,
    validityDays: null,
    sortOrder,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}
