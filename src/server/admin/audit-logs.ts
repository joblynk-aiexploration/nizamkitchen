import { Prisma } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminAuditLogFilterSchema } from "@/lib/validation/admin";
import { getAuditSeverity } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

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
            lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
          }
        : undefined,
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actorUser: true,
      organization: true,
      country: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const filteredBySeverity = filters.severity
    ? logs.filter((log) => getAuditSeverity(log.action) === filters.severity)
    : logs;

  return {
    filters,
    logs: filteredBySeverity,
    selectedLog:
      filters.logId
        ? filteredBySeverity.find((log) => log.id === filters.logId) ?? null
        : null,
  };
}
