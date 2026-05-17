import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorUserId?: string | null;
  organizationId?: string | null;
  countryCode?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      organizationId: input.organizationId ?? null,
      countryCode: input.countryCode ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      details: input.details,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
