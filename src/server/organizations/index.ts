import { MembershipStatus, type Prisma } from "@prisma/client";
import { AccessDeniedError, assertMembershipAccess } from "@/lib/auth";
import type { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied } from "@/server/audit";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export function scopedOrganizationWhere<T extends Prisma.MembershipWhereInput | Prisma.AuditLogWhereInput | Prisma.BillingSubscriptionWhereInput | Prisma.ApiKeyWhereInput>(
  organizationId: string,
  where?: Omit<T, "organizationId">,
) {
  return {
    organizationId,
    ...(where ?? {}),
  } as T;
}

export async function requireOrganizationAccess(session: Session, organizationId?: string) {
  try {
    return assertMembershipAccess(session, organizationId);
  } catch (error) {
    await auditAccessDenied({
      session,
      targetType: "organization",
      targetId: organizationId ?? session.activeOrganization?.id ?? null,
      details: { reason: error instanceof AccessDeniedError ? error.code : "UNKNOWN" },
    });
    throw error;
  }
}

export async function verifyOrganizationMembership(params: {
  userId: string;
  organizationId: string;
}) {
  return prisma.membership.findFirst({
    where: {
      userId: params.userId,
      organizationId: params.organizationId,
      status: MembershipStatus.active,
    },
  });
}

export async function listUserOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: {
      userId,
      status: MembershipStatus.active,
    },
    include: {
      organization: {
        include: {
          country: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
