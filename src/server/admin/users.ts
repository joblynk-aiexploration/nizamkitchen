import { PlatformRole } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { platformRoleUpdateSchema, userStatusUpdateSchema } from "@/lib/validation/admin";
import { recordAdminAuditLog } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function listAdminUsers(
  session: Session,
  filters: {
    search?: string;
    platformRole?: string;
    countryCode?: string;
    organizationId?: string;
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

  const countryCondition = isCountryManager
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

  const filteredCountryCondition = filters.countryCode
    ? {
        OR: [
          { countryAssignments: { some: { countryCode: filters.countryCode } } },
          {
            memberships: {
              some: {
                organization: {
                  countryCode: filters.countryCode,
                },
              },
            },
          },
        ],
      }
    : {};

  return prisma.user.findMany({
    where: {
      ...countryCondition,
      ...filteredCountryCondition,
      platformRole: filters.platformRole
        ? (filters.platformRole as PlatformRole)
        : undefined,
      memberships: filters.organizationId
        ? {
            some: {
              organizationId: filters.organizationId,
            },
          }
        : undefined,
      OR: filters.search
        ? [
            { email: { contains: filters.search, mode: "insensitive" } },
            { fullName: { contains: filters.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
      countryAssignments: {
        include: {
          country: true,
        },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminUserDetail(session: Session, id: string) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          organization: {
            include: {
              country: true,
            },
          },
        },
      },
      countryAssignments: {
        include: {
          country: true,
        },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (session.user.platformRole === "country_manager") {
    const countryCodes = new Set([
      ...user.countryAssignments.map((assignment) => assignment.countryCode),
      ...user.memberships.map((membership) => membership.organization.countryCode),
    ]);
    for (const code of countryCodes) {
      assertCountryAccess(session, code);
    }
  }

  return user;
}

export async function updateUserStatus(session: Session, id: string, input: unknown) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = userStatusUpdateSchema.parse(input);

  const user = await prisma.user.update({
    where: { id },
    data: {
      status: parsed.status,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "user.updated",
    targetType: "user",
    targetId: id,
    details: parsed,
  });

  return user;
}

export async function updateUserPlatformRole(
  session: Session,
  id: string,
  input: unknown,
) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = platformRoleUpdateSchema.parse(input);

  const user = await prisma.user.update({
    where: { id },
    data: {
      platformRole: parsed.platformRole,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "role.changed",
    targetType: "user",
    targetId: id,
    details: parsed,
  });

  return user;
}
