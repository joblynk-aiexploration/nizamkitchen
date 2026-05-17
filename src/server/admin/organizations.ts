import { MembershipStatus, OrganizationStatus, OrganizationType } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  organizationMetadataUpdateSchema,
  organizationStatusUpdateSchema,
} from "@/lib/validation/admin";
import { recordAdminAuditLog } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function listAdminOrganizations(
  session: Session,
  filters: {
    search?: string;
    countryCode?: string;
    organizationType?: string;
    status?: string;
  },
) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);

  if (isCountryManager && filters.countryCode) {
    assertCountryAccess(session, filters.countryCode);
  }

  return prisma.organization.findMany({
    where: {
      countryCode: isCountryManager
        ? filters.countryCode || { in: assignedCountries }
        : filters.countryCode || undefined,
      organizationType: filters.organizationType
        ? (filters.organizationType as OrganizationType)
        : undefined,
      status: filters.status ? (filters.status as OrganizationStatus) : undefined,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: "insensitive" } },
            {
              memberships: {
                some: {
                  user: {
                    email: { contains: filters.search, mode: "insensitive" },
                  },
                },
              },
            },
          ]
        : undefined,
    },
    include: {
      country: true,
      memberships: {
        where: { status: MembershipStatus.active },
        include: { user: true },
      },
      featureFlags: true,
      _count: {
        select: {
          memberships: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminOrganizationDetail(session: Session, id: string) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      country: true,
      memberships: {
        include: {
          user: true,
        },
        orderBy: { createdAt: "asc" },
      },
      featureFlags: true,
      billingSubscriptions: true,
      auditLogs: {
        include: {
          actorUser: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  if (session.user.platformRole === "country_manager") {
    assertCountryAccess(session, organization.countryCode);
  }

  return organization;
}

export async function updateOrganizationStatus(
  session: Session,
  id: string,
  input: unknown,
) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = organizationStatusUpdateSchema.parse(input);

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      status: parsed.status,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: id,
    countryCode: organization.countryCode,
    action: "organization.updated",
    targetType: "organization",
    targetId: id,
    details: parsed,
  });

  return organization;
}

export async function updateOrganizationMetadata(
  session: Session,
  id: string,
  input: unknown,
) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = organizationMetadataUpdateSchema.parse(input);

  const organization = await prisma.organization.update({
    where: { id },
    data: parsed,
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: id,
    countryCode: organization.countryCode,
    action: "organization.updated",
    targetType: "organization",
    targetId: id,
    details: parsed,
  });

  return organization;
}
