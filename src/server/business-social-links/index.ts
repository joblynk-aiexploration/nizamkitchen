import { BusinessProfileType, OrganizationType, type PlatformRole, type UserStatus } from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { businessSocialLinkDeleteSchema, businessSocialLinkSchema } from "@/lib/validation/social-links";
import { createAuditEvent } from "@/server/audit";

type AdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

const SOCIAL_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];

export function profileTypeForOrganizationType(organizationType: string) {
  if (organizationType === OrganizationType.home_catering) return BusinessProfileType.home_catering;
  if (organizationType === OrganizationType.chef_business) return BusinessProfileType.chef_business;
  if (organizationType === OrganizationType.restaurant) return BusinessProfileType.restaurant;
  throw new Error("Social links are available only for business organizations.");
}

export async function listBusinessSocialLinks(organizationId: string) {
  return prisma.businessSocialLink.findMany({
    where: { organizationId },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function listPublicBusinessSocialLinks(organizationId: string, profileType: BusinessProfileType) {
  return prisma.businessSocialLink.findMany({
    where: { organizationId, profileType, isPublic: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function upsertBusinessSocialLink(params: {
  organizationId: string;
  organizationType: string;
  countryCode: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = businessSocialLinkSchema.parse(params.input);
  const expectedProfileType = profileTypeForOrganizationType(params.organizationType);
  if (parsed.profileType !== expectedProfileType) {
    throw new Error("Social link profile type does not match this organization.");
  }
  const existing = parsed.linkId
    ? await prisma.businessSocialLink.findFirst({ where: { id: parsed.linkId, organizationId: params.organizationId } })
    : null;
  const link = existing
    ? await prisma.businessSocialLink.update({
        where: { id: existing.id },
        data: {
          platform: parsed.platform,
          label: parsed.label ?? null,
          url: parsed.url,
          displayOrder: parsed.displayOrder,
          isPublic: parsed.isPublic,
        },
      })
    : await prisma.businessSocialLink.create({
        data: {
          organizationId: params.organizationId,
          profileType: parsed.profileType,
          platform: parsed.platform,
          label: parsed.label ?? null,
          url: parsed.url,
          displayOrder: parsed.displayOrder,
          isPublic: parsed.isPublic,
        },
      });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: existing ? "business_social_link.updated" : "business_social_link.created",
    targetType: "business_social_link",
    targetId: link.id,
    details: { platform: link.platform, isPublic: link.isPublic },
  });
  return link;
}

export async function deleteBusinessSocialLink(params: {
  organizationId: string;
  countryCode: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = businessSocialLinkDeleteSchema.parse(params.input);
  const existing = await prisma.businessSocialLink.findFirst({ where: { id: parsed.linkId, organizationId: params.organizationId } });
  if (!existing) throw new Error("Social link not found.");
  await prisma.businessSocialLink.delete({ where: { id: existing.id } });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "business_social_link.deleted",
    targetType: "business_social_link",
    targetId: existing.id,
    details: { platform: existing.platform },
  });
  return existing;
}

export async function moderateDeleteBusinessSocialLink(params: {
  session: AdminSession;
  linkId: string;
}) {
  assertPlatformRole(params.session.user.platformRole, SOCIAL_ADMIN_ROLES);
  const existing = await prisma.businessSocialLink.findUnique({
    where: { id: params.linkId },
    include: { organization: { select: { countryCode: true } } },
  });
  if (!existing) throw new Error("Social link not found.");
  if (params.session.user.platformRole === "country_manager") {
    assertCountryAccess(params.session, existing.organization.countryCode);
  }
  await prisma.businessSocialLink.delete({ where: { id: existing.id } });
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.organization.countryCode,
    action: "business_social_link.moderated",
    targetType: "business_social_link",
    targetId: existing.id,
    details: { platform: existing.platform, reason: "Removed by platform admin" },
  });
  return existing;
}
