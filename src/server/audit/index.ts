import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIpFromHeaders } from "@/lib/security";

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

export async function createAuditEvent(input: AuditInput) {
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

export async function auditAccessDenied(params: {
  session?: {
    user: { id: string };
    activeOrganization?: { id: string; countryCode: string } | null;
  } | null;
  targetType: string;
  targetId?: string | null;
  details?: Prisma.InputJsonValue;
}) {
  const headerStore = await headers();
  const requestMeta = {
    ipAddress: getClientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  };

  return createAuditEvent({
    actorUserId: params.session?.user.id ?? null,
    organizationId: params.session?.activeOrganization?.id ?? null,
    countryCode: params.session?.activeOrganization?.countryCode ?? null,
    action: "access.denied",
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    details: params.details,
    ...requestMeta,
  });
}
