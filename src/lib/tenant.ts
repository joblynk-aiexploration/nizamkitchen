import { MembershipStatus } from "@prisma/client";
import { AccessDeniedError, assertMembershipAccess } from "@/lib/auth";
import { requireMembership, requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied } from "@/server/audit";

export async function getActiveOrganizationContext() {
  const session = await requireMembership();

  return {
    user: session.user,
    membership: session.activeMembership,
    organization: session.activeOrganization,
  };
}

export async function assertOrganizationAccess(organizationId: string) {
  const session = await requireUser();

  try {
    assertMembershipAccess(session, organizationId);
  } catch (error) {
    await auditAccessDenied({
      session,
      targetType: "organization",
      targetId: organizationId,
      details: { reason: error instanceof AccessDeniedError ? error.code : "UNKNOWN" },
    });
    throw error;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organizationId,
      status: MembershipStatus.active,
    },
  });

  if (!membership) {
    throw new AccessDeniedError("Cross-tenant access denied.", "MEMBERSHIP_REQUIRED");
  }

  return membership;
}

export function organizationScope<T extends { organizationId: string }>(
  organizationId: string,
  input?: Omit<T, "organizationId">,
) {
  return {
    organizationId,
    ...(input ?? {}),
  } as T;
}
