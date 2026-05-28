import { prisma } from "@/lib/prisma";
import {
  ORGANIZATION_ROLE_PERMISSION_DEFAULTS,
  PERMISSION_DEFINITIONS,
  PLATFORM_ROLE_ORDER,
  ROLE_PERMISSION_DEFAULTS,
} from "@/server/rbac/permission-catalog";

export async function listRoleAccessMatrix() {
  const [permissions, rolePermissions, overrides] = await Promise.all([
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] }),
    prisma.rolePermission.findMany({ include: { permission: true } }),
    prisma.userPermissionOverride.findMany({
      include: {
        permission: true,
        user: { select: { id: true, email: true, fullName: true, platformRole: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const permissionRows =
    permissions.length > 0
      ? permissions
      : PERMISSION_DEFINITIONS.map((permission) => ({
          ...permission,
          id: permission.key,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }));

  const storedByRole = new Map<string, Set<string>>();
  for (const rolePermission of rolePermissions) {
    const mapKey = `${rolePermission.roleScope}:${rolePermission.roleName}`;
    const set = storedByRole.get(mapKey) ?? new Set<string>();
    set.add(rolePermission.permission.key);
    storedByRole.set(mapKey, set);
  }

  const platformRoles = PLATFORM_ROLE_ORDER.map((role) => ({
    scope: "platform" as const,
    role,
    permissions: storedByRole.get(`platform:${role}`) ?? new Set(ROLE_PERMISSION_DEFAULTS[role] ?? []),
  }));

  const organizationRoles = Object.entries(ORGANIZATION_ROLE_PERMISSION_DEFAULTS).map(
    ([role, defaults]) => ({
      scope: "organization" as const,
      role,
      permissions: storedByRole.get(`organization:${role}`) ?? new Set(defaults),
    }),
  );

  return {
    permissions: permissionRows,
    platformRoles,
    organizationRoles,
    overrides,
  };
}

export async function getRoleAccess(roleScope: "platform" | "organization" | "country", roleName: string) {
  const [permissions, rolePermissions] = await Promise.all([
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] }),
    prisma.rolePermission.findMany({
      where: { roleScope, roleName },
      include: { permission: true },
    }),
  ]);

  const stored = new Set(rolePermissions.map((binding) => binding.permission.key));
  const defaults =
    roleScope === "platform"
      ? ROLE_PERMISSION_DEFAULTS[roleName as keyof typeof ROLE_PERMISSION_DEFAULTS] ?? []
      : ORGANIZATION_ROLE_PERMISSION_DEFAULTS[roleName] ?? [];

  return {
    permissions: permissions.length > 0 ? permissions : PERMISSION_DEFINITIONS,
    enabledKeys: stored.size > 0 ? stored : new Set(defaults),
  };
}
