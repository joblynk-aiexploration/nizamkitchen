import { MembershipStatus } from "@prisma/client";
import { requireMembership, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organizationId,
      status: MembershipStatus.active,
    },
  });

  if (!membership) {
    throw new Error("Cross-tenant access denied.");
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
