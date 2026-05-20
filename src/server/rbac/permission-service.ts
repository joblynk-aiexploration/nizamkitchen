import { AccessDeniedError, assertCountryAccess, assertPlatformRole, type SessionLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { getCurrentSession } from "@/lib/session";
import { PERMISSION_DEFINITIONS, ROLE_PERMISSION_DEFAULTS } from "@/server/rbac/permission-catalog";

export type RbacSession = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export function getPermissionDefinition(key: string) {
  return PERMISSION_DEFINITIONS.find((permission) => permission.key === key) ?? null;
}

export function hasDefaultRolePermission(session: Pick<RbacSession, "user">, permissionKey: string) {
  const role = session.user.platformRole;
  if (!role) {
    return false;
  }

  return ROLE_PERMISSION_DEFAULTS[role]?.includes(permissionKey) ?? false;
}

export async function hasPermission(session: RbacSession, permissionKey: string) {
  const override = await prisma.userPermissionOverride.findFirst({
    where: {
      userId: session.user.id,
      permission: { key: permissionKey },
    },
    select: { effect: true },
  });

  if (override?.effect === "deny") {
    return false;
  }

  if (override?.effect === "allow") {
    return true;
  }

  const roleName = session.user.platformRole;
  if (roleName) {
    const storedRolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleScope: "platform",
        roleName,
        permission: { key: permissionKey },
      },
      select: { id: true },
    });

    if (storedRolePermission || hasDefaultRolePermission(session, permissionKey)) {
      return true;
    }
  }

  const membershipRole = session.activeMembership?.role;
  if (membershipRole) {
    const storedOrgPermission = await prisma.rolePermission.findFirst({
      where: {
        roleScope: "organization",
        roleName: membershipRole,
        permission: { key: permissionKey },
      },
      select: { id: true },
    });
    return Boolean(storedOrgPermission);
  }

  return false;
}

export async function requirePermission(session: RbacSession, permissionKey: string) {
  if (!(await hasPermission(session, permissionKey))) {
    throw new AccessDeniedError(`Missing permission: ${permissionKey}`, "ROLE_REQUIRED");
  }
}

export function requirePlatformRole(
  session: Pick<RbacSession, "user">,
  roles: NonNullable<RbacSession["user"]["platformRole"]>[],
) {
  assertPlatformRole(session.user.platformRole, roles);
}

export function requireOrganizationRole(
  session: Pick<RbacSession, "activeMembership">,
  organizationId: string,
  roles: NonNullable<RbacSession["activeMembership"]>["role"][],
) {
  const membership = session.activeMembership;
  if (!membership || membership.organizationId !== organizationId || !roles.includes(membership.role)) {
    throw new AccessDeniedError("Organization role is required.", "ROLE_REQUIRED");
  }
}

export function requireCountryAccess(session: SessionLike, countryCode: string) {
  return assertCountryAccess(session, countryCode);
}

export function canManagePaymentGateway(session: Pick<RbacSession, "user">) {
  return session.user.platformRole === "platform_owner";
}

export function canManageStorage(session: Pick<RbacSession, "user">) {
  return session.user.platformRole === "platform_owner";
}

export async function canManageUser(actor: RbacSession, targetUserId: string) {
  if (actor.user.platformRole === "platform_owner") {
    return true;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { platformRole: true },
  });

  if (!target) {
    return false;
  }

  return actor.user.platformRole === "platform_admin" && target.platformRole !== "platform_owner";
}

export function canDeleteRecord(session: Pick<RbacSession, "user">, module: string) {
  if (session.user.platformRole !== "platform_owner") {
    return false;
  }

  return !["users:last_platform_owner", "payments:secret", "storage:secret"].includes(module);
}

export async function listPermissionsForAdmin() {
  const permissions = await prisma.permission.findMany({
    include: {
      roleBindings: true,
      _count: { select: { userOverrides: true } },
    },
    orderBy: [{ module: "asc" }, { key: "asc" }],
  });

  if (permissions.length > 0) {
    return permissions;
  }

  return PERMISSION_DEFINITIONS.map((permission) => ({
    ...permission,
    id: permission.key,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    roleBindings: [],
    _count: { userOverrides: 0 },
  }));
}
