import { Prisma } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { paginatedQuery } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  countryCreateSchema,
  countryManagerUpdateSchema,
  countryUpdateSchema,
} from "@/lib/validation/admin";
import { recordAdminAuditLog } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function listAdminCountries(
  session: Session,
  filters?: { query?: string; onlyActive?: string; countryCode?: string; page?: string | string[] | number; pageSize?: string | string[] | number },
) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const countryCodes = session.countryAssignments.map((assignment) => assignment.countryCode);

  const where: Prisma.CountryWhereInput = {
      countryCode:
        filters?.countryCode && !isCountryManager
          ? filters.countryCode.toUpperCase()
          : isCountryManager
            ? { in: countryCodes }
            : undefined,
      isActive:
        filters?.onlyActive === "active"
          ? true
          : filters?.onlyActive === "inactive"
            ? false
            : undefined,
      OR: filters?.query
        ? [
            { countryName: { contains: filters.query, mode: "insensitive" as const } },
            { countryCode: { contains: filters.query.toUpperCase(), mode: "insensitive" as const } },
          ]
        : undefined,
  };

  return paginatedQuery(
    prisma.country.count({ where }),
    ({ skip, take }) =>
      prisma.country.findMany({
        where,
        include: {
          countryAssignments: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              organizations: true,
            },
          },
        },
        orderBy: { countryName: "asc" },
        skip,
        take,
      }),
    { page: filters?.page, pageSize: filters?.pageSize },
  );
}

export async function getAdminCountryDetail(session: Session, countryCode: string) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  if (session.user.platformRole === "country_manager") {
    assertCountryAccess(session, countryCode);
  }

  const country = await prisma.country.findUnique({
    where: { countryCode },
    include: {
      countryAssignments: {
        include: {
          user: true,
        },
      },
      organizations: {
        include: {
          memberships: true,
          featureFlags: true,
        },
        orderBy: { createdAt: "desc" },
      },
      auditLogs: {
        include: {
          actorUser: true,
          organization: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!country) {
    throw new Error("Country not found.");
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { countryAssignments: { some: { countryCode } } },
        {
          memberships: {
            some: {
              organization: {
                countryCode,
              },
            },
          },
        },
      ],
    },
    include: {
      countryAssignments: true,
      memberships: {
        include: {
          organization: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    country,
    users,
  };
}

export async function createCountry(session: Session, input: unknown) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = countryCreateSchema.parse(input);

  const country = await prisma.country.create({
    data: {
      countryCode: parsed.countryCode,
      countryName: parsed.countryName,
      currencyCode: parsed.currencyCode,
      defaultTimezone: parsed.defaultTimezone,
      defaultLocale: parsed.defaultLocale,
      measurementSystem: parsed.measurementSystem,
      phoneCountryCode: parsed.phoneCountryCode,
      isActive: parsed.isActive,
      supportedModules: parsed.supportedModules,
      countryAssignments: parsed.managerUserIds.length
        ? {
            createMany: {
              data: parsed.managerUserIds.map((userId) => ({
                userId,
              })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    countryCode: country.countryCode,
    action: "country.created",
    targetType: "country",
    targetId: country.countryCode,
    details: parsed,
  });

  return country;
}

export async function updateCountry(session: Session, countryCode: string, input: unknown) {
  const isCountryManager = session.user.platformRole === "country_manager";

  if (isCountryManager) {
    assertCountryAccess(session, countryCode);
    const parsed = countryManagerUpdateSchema.parse(input);
    const country = await prisma.country.update({
      where: { countryCode },
      data: {
        defaultTimezone: parsed.defaultTimezone,
        defaultLocale: parsed.defaultLocale,
        measurementSystem: parsed.measurementSystem,
        phoneCountryCode: parsed.phoneCountryCode,
        supportedModules: parsed.supportedModules,
      },
    });

    await recordAdminAuditLog({
      actorUserId: session.user.id,
      countryCode,
      action: "country.updated",
      targetType: "country",
      targetId: countryCode,
      details: parsed,
    });

    return country;
  }

  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = countryUpdateSchema.parse(input);

  const country = await prisma.country.update({
    where: { countryCode },
    data: {
      countryName: parsed.countryName,
      currencyCode: parsed.currencyCode,
      defaultTimezone: parsed.defaultTimezone,
      defaultLocale: parsed.defaultLocale,
      measurementSystem: parsed.measurementSystem,
      phoneCountryCode: parsed.phoneCountryCode,
      supportedModules: parsed.supportedModules,
      isActive: parsed.isActive,
    },
  });

  await prisma.countryAssignment.deleteMany({
    where: { countryCode },
  });

  if (parsed.managerUserIds.length) {
    await prisma.countryAssignment.createMany({
      data: parsed.managerUserIds.map((userId) => ({
        countryCode,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    countryCode,
    action: "country.updated",
    targetType: "country",
    targetId: countryCode,
    details: parsed,
  });

  return country;
}

export function buildCountryMutationInput(formData: FormData) {
  return {
    countryCode: formData.get("countryCode"),
    countryName: formData.get("countryName"),
    currencyCode: formData.get("currencyCode"),
    defaultTimezone: formData.get("defaultTimezone"),
    defaultLocale: formData.get("defaultLocale"),
    measurementSystem: formData.get("measurementSystem"),
    phoneCountryCode: formData.get("phoneCountryCode"),
    isActive: formData.get("isActive") === "on",
    supportedModules: formData.getAll("supportedModules").map(String),
    managerUserIds: formData.getAll("managerUserIds").map(String),
  };
}
