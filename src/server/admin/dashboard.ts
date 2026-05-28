import { OrganizationStatus, Prisma } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PLATFORM_ADMIN_ROLES, assertCountryAccess, assertPlatformRole } from "@/lib/auth";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function getAdminDashboardData(session: Session) {
  assertPlatformRole(session.user.platformRole, PLATFORM_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);

  const organizationWhere: Prisma.OrganizationWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};
  const userWhere: Prisma.UserWhereInput = isCountryManager
    ? {
        OR: [
          { countryAssignments: { some: { countryCode: { in: assignedCountries } } } },
          {
            memberships: {
              some: {
                organization: {
                  countryCode: { in: assignedCountries },
                },
              },
            },
          },
        ],
      }
    : {};
  const auditWhere: Prisma.AuditLogWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};
  const countryWhere: Prisma.CountryWhereInput = isCountryManager
    ? { countryCode: { in: assignedCountries } }
    : {};

  const [
    totalUsers,
    totalOrganizations,
    activeCountries,
    disabledCountries,
    recentAuditLogs,
    recentSignups,
    riskyOrganizations,
    accessDeniedCount,
    organizationsByTypeRaw,
    usersByPlatformRoleRaw,
    usersByOrganizationRoleRaw,
    featureFlagRows,
    billingRows,
  ] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.organization.count({ where: organizationWhere }),
    prisma.country.count({ where: { ...countryWhere, isActive: true } }),
    prisma.country.count({ where: { ...countryWhere, isActive: false } }),
    prisma.auditLog.findMany({
      where: auditWhere,
      include: {
        actorUser: true,
        organization: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.organization.findMany({
      where: {
        ...organizationWhere,
        status: {
          in: [OrganizationStatus.disabled, OrganizationStatus.suspended],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.auditLog.count({
      where: {
        ...auditWhere,
        action: "access.denied",
      },
    }),
    prisma.organization.groupBy({
      by: ["organizationType"],
      _count: { _all: true },
      where: organizationWhere,
    }),
    prisma.user.groupBy({
      by: ["platformRole"],
      _count: { _all: true },
      where: userWhere,
    }),
    prisma.membership.groupBy({
      by: ["role"],
      _count: { _all: true },
      where: isCountryManager
        ? {
            organization: {
              countryCode: { in: assignedCountries },
            },
          }
        : {},
    }),
    prisma.featureFlag.findMany({
      where: isCountryManager
        ? {
            OR: [
              { countryCode: { in: assignedCountries } },
              { countryCode: null, organizationId: null },
            ],
          }
        : {},
      orderBy: { updatedAt: "desc" },
    }),
    prisma.billingSubscription.findMany({
      where: isCountryManager
        ? { organization: { countryCode: { in: assignedCountries } } }
        : {},
      include: { plan: { select: { slug: true, name: true } } },
    }),
  ]);

  return {
    totalUsers,
    totalOrganizations,
    activeCountries,
    disabledCountries,
    recentAuditLogs,
    recentSignups,
    riskyOrganizations,
    accessDeniedCount,
    organizationsByType: organizationsByTypeRaw.map((row) => ({
      label: row.organizationType,
      count: row._count._all,
    })),
    usersByPlatformRole: usersByPlatformRoleRaw.map((row) => ({
      label: row.platformRole ?? "none",
      count: row._count._all,
    })),
    usersByOrganizationRole: usersByOrganizationRoleRaw.map((row) => ({
      label: row.role,
      count: row._count._all,
    })),
    featureFlagSummary: {
      total: featureFlagRows.length,
      enabled: featureFlagRows.filter((flag) => flag.enabled).length,
      disabled: featureFlagRows.filter((flag) => !flag.enabled).length,
    },
    billingSummary: {
      totalSubscriptions: billingRows.length,
      trialing: billingRows.filter((item) => item.status === "trialing").length,
      active: billingRows.filter((item) => item.status === "active").length,
    },
    supportSummary: {
      recentUsers: recentSignups.length,
      recentOrganizations: recentAuditLogs.filter((log) => log.action === "organization.created").length,
      accessDeniedCount,
      supportNotesPlaceholder: 0,
    },
  };
}

export function assertSessionCanViewCountry(session: Session, countryCode: string) {
  return assertCountryAccess(session, countryCode);
}
