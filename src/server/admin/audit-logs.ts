import { Prisma } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminAuditLogFilterSchema } from "@/lib/validation/admin";
import { getAuditSeverity } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

const AUDIT_LOG_PAGE_SIZE = 10;
const SEVERITY_FILTER_SCAN_LIMIT = 1000;

export async function listAdminAuditLogs(session: Session, rawFilters: Record<string, string | undefined>) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
    "country_manager",
  ]);

  const filters = adminAuditLogFilterSchema.parse(rawFilters);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);

  if (isCountryManager && filters.countryCode) {
    assertCountryAccess(session, filters.countryCode);
  }

  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;
  if (dateTo) {
    dateTo.setHours(23, 59, 59, 999);
  }

  const where: Prisma.AuditLogWhereInput = {
    action: filters.action
      ? { contains: filters.action, mode: "insensitive" }
      : undefined,
    actorUserId: filters.actorUserId || undefined,
    organizationId: filters.organizationId || undefined,
    countryCode: isCountryManager
      ? filters.countryCode || { in: assignedCountries }
      : filters.countryCode || undefined,
    createdAt:
      filters.dateFrom || filters.dateTo
        ? {
            gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
            lte: dateTo,
          }
        : undefined,
  };

  const skip = (filters.page - 1) * AUDIT_LOG_PAGE_SIZE;
  const include = {
    actorUser: true,
    organization: true,
    country: true,
  } satisfies Prisma.AuditLogInclude;

  const severityFilteredLogs = filters.severity
    ? (await prisma.auditLog.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        take: SEVERITY_FILTER_SCAN_LIMIT,
      })).filter((log) => getAuditSeverity(log.action) === filters.severity)
    : null;

  const [totalLogs, logs] = severityFilteredLogs
    ? [severityFilteredLogs.length, severityFilteredLogs.slice(skip, skip + AUDIT_LOG_PAGE_SIZE)] as const
    : await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          include,
          orderBy: { createdAt: "desc" },
          skip,
          take: AUDIT_LOG_PAGE_SIZE,
        }),
      ]);

  const totalPages = Math.max(1, Math.ceil(totalLogs / AUDIT_LOG_PAGE_SIZE));

  return {
    filters,
    logs,
    pagination: {
      page: filters.page,
      pageSize: AUDIT_LOG_PAGE_SIZE,
      totalLogs,
      totalPages,
      hasPreviousPage: filters.page > 1,
      hasNextPage: filters.page < totalPages,
    },
    selectedLog:
      filters.logId
        ? logs.find((log) => log.id === filters.logId) ?? null
        : null,
  };
}
