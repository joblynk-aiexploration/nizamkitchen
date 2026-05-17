import type { Prisma } from "@prisma/client";
import { createAuditEvent } from "@/server/audit";

type AuditActor = {
  actorUserId?: string | null;
  organizationId?: string | null;
  countryCode?: string | null;
};

export async function recordAdminAuditLog(input: AuditActor & {
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Prisma.InputJsonValue;
}) {
  return createAuditEvent({
    actorUserId: input.actorUserId ?? null,
    organizationId: input.organizationId ?? null,
    countryCode: input.countryCode ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    details: input.details,
  });
}

export function getAuditSeverity(action: string) {
  if (action === "access.denied") {
    return "warning" as const;
  }

  if (
    action.includes("disabled") ||
    action.includes("suspended") ||
    action.includes("revoked")
  ) {
    return "critical" as const;
  }

  return "info" as const;
}
