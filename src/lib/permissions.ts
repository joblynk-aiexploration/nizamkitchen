import type { Membership, PlatformRole } from "@prisma/client";

type Permission =
  | "organization:view"
  | "organization:update"
  | "membership:view"
  | "membership:manage"
  | "billing:view"
  | "developer:view"
  | "audit:view"
  | "admin:access"
  | "countries:manage"
  | "feature_flags:manage"
  | "settings:manage";

const platformPermissionMap: Partial<Record<PlatformRole, Permission[]>> = {
  platform_owner: [
    "admin:access",
    "countries:manage",
    "feature_flags:manage",
    "settings:manage",
    "audit:view",
  ],
  platform_admin: [
    "admin:access",
    "countries:manage",
    "feature_flags:manage",
    "settings:manage",
    "audit:view",
  ],
  country_manager: ["admin:access", "countries:manage", "audit:view"],
  support_admin: ["admin:access", "audit:view"],
  auditor: ["admin:access", "audit:view"],
};

const organizationPermissionMap: Record<string, Permission[]> = {
  org_owner: [
    "organization:view",
    "organization:update",
    "membership:view",
    "membership:manage",
    "billing:view",
    "developer:view",
    "audit:view",
  ],
  org_admin: [
    "organization:view",
    "organization:update",
    "membership:view",
    "membership:manage",
    "billing:view",
    "developer:view",
    "audit:view",
  ],
  member: ["organization:view"],
  chef_owner: [
    "organization:view",
    "organization:update",
    "membership:view",
    "membership:manage",
    "billing:view",
    "developer:view",
    "audit:view",
  ],
  chef_staff: ["organization:view", "membership:view"],
  restaurant_owner: [
    "organization:view",
    "organization:update",
    "membership:view",
    "membership:manage",
    "billing:view",
    "developer:view",
    "audit:view",
  ],
  restaurant_staff: ["organization:view", "membership:view"],
  grocery_partner_admin: [
    "organization:view",
    "organization:update",
    "membership:view",
    "membership:manage",
    "billing:view",
    "developer:view",
    "audit:view",
  ],
};

export function hasPermission(params: {
  platformRole?: PlatformRole | null;
  membershipRole?: Membership["role"] | null;
  permission: Permission;
}) {
  const platformPermissions = params.platformRole
    ? platformPermissionMap[params.platformRole] ?? []
    : [];
  const membershipPermissions = params.membershipRole
    ? organizationPermissionMap[params.membershipRole] ?? []
    : [];

  return (
    platformPermissions.includes(params.permission) ||
    membershipPermissions.includes(params.permission)
  );
}

export function canManageCountry(params: {
  platformRole?: PlatformRole | null;
  assignedCountries: string[];
  countryCode: string;
}) {
  if (params.platformRole === "platform_owner" || params.platformRole === "platform_admin") {
    return true;
  }

  if (params.platformRole !== "country_manager") {
    return false;
  }

  return params.assignedCountries.includes(params.countryCode);
}
