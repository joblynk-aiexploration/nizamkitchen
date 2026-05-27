import { randomBytes } from "node:crypto";
import { PlatformRole, Prisma } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { paginatedQuery } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { adminUserCreateSchema, platformRoleUpdateSchema, userStatusUpdateSchema } from "@/lib/validation/admin";
import { recordAdminAuditLog } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function listAdminUsers(
  session: Session,
  filters: {
    search?: string;
    platformRole?: string;
    countryCode?: string;
    organizationId?: string;
    page?: string | string[] | number;
    pageSize?: string | string[] | number;
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

  const where: Prisma.UserWhereInput = {
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
            { email: { contains: filters.search, mode: "insensitive" as const } },
            { fullName: { contains: filters.search, mode: "insensitive" as const } },
          ]
        : undefined,
  };

  return paginatedQuery(
    prisma.user.count({ where }),
    ({ skip, take }) =>
      prisma.user.findMany({
        where,
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
        skip,
        take,
      }),
    { page: filters.page, pageSize: filters.pageSize },
  );
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
      oauthAccounts: {
        select: {
          id: true,
          provider: true,
          email: true,
          emailVerified: true,
          displayName: true,
          avatarUrl: true,
          tokenExpiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
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

export async function createAdminUser(session: Session, input: unknown) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = adminUserCreateSchema.parse(input);

  if (parsed.platformRole === "platform_owner" && session.user.platformRole !== "platform_owner") {
    throw new Error("Only the platform owner can create another platform owner.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });
  if (existingUser) {
    throw new Error("A user with this email already exists.");
  }

  if (parsed.organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: parsed.organizationId },
      select: { id: true },
    });
    if (!organization) throw new Error("Selected organization was not found.");
  }

  if (parsed.countryCodes.length) {
    const countries = await prisma.country.findMany({
      where: { countryCode: { in: parsed.countryCodes } },
      select: { countryCode: true },
    });
    const validCountryCodes = new Set(countries.map((country) => country.countryCode));
    const missingCountry = parsed.countryCodes.find((code) => !validCountryCodes.has(code));
    if (missingCountry) throw new Error(`Country ${missingCountry} was not found.`);
  }

  const passwordHash = await hashPassword(parsed.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      fullName: parsed.fullName,
      passwordHash,
      status: parsed.status,
      platformRole: parsed.platformRole,
      memberships: parsed.organizationId
        ? {
            create: {
              organizationId: parsed.organizationId,
              role: parsed.organizationRole,
              status: "active",
            },
          }
        : undefined,
      countryAssignments: parsed.countryCodes.length
        ? {
            create: parsed.countryCodes.map((countryCode) => ({ countryCode })),
          }
        : undefined,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "user.created",
    targetType: "user",
    targetId: user.id,
    details: {
      platformRole: parsed.platformRole,
      status: parsed.status,
      organizationId: parsed.organizationId,
      organizationRole: parsed.organizationId ? parsed.organizationRole : null,
      countryCodes: parsed.countryCodes,
    },
  });

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

export async function deleteAdminUser(session: Session, id: string, input: unknown) {
  assertPlatformRole(session.user.platformRole, ["platform_owner"]);
  const confirm = typeof input === "object" && input && "confirm" in input
    ? String(input.confirm ?? "").trim().toUpperCase()
    : "";

  if (confirm !== "DELETE") {
    throw new Error("Type DELETE to confirm removing this user.");
  }

  if (id === session.user.id) {
    throw new Error("You cannot delete your own Platform Owner account.");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      platformRole: true,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.platformRole === PlatformRole.platform_owner) {
    const ownerCount = await prisma.user.count({
      where: {
        platformRole: PlatformRole.platform_owner,
        status: "active",
      },
    });

    if (ownerCount <= 1) {
      throw new Error("You cannot remove the last active Platform Owner.");
    }
  }

  const deletedEmail = `deleted-${user.id}@nizamkitchen.deleted`;
  const lockedPasswordHash = `deleted:${randomBytes(32).toString("hex")}`;

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.oAuthAccount.deleteMany({ where: { userId: id } }),
    prisma.countryAssignment.deleteMany({ where: { userId: id } }),
    prisma.membership.updateMany({
      where: { userId: id },
      data: { status: "removed" },
    }),
    prisma.userPermissionOverride.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: {
        email: deletedEmail,
        passwordHash: lockedPasswordHash,
        fullName: "Deleted User",
        status: "disabled",
        platformRole: null,
        profilePhotoFileId: null,
        coverPhotoFileId: null,
        headline: null,
        bio: null,
        location: null,
        locationText: null,
        phone: null,
        religion: null,
        preferredLanguage: null,
        publicProfileEnabled: false,
      },
    }),
  ]);

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "user.deleted",
    targetType: "user",
    targetId: id,
    details: {
      previousEmail: user.email,
      previousName: user.fullName,
      previousPlatformRole: user.platformRole,
      deletionMode: "safe_anonymized_access_removed",
    },
  });

  return { id, email: deletedEmail };
}
