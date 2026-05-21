import type { Membership, PlatformRole } from "@prisma/client";
import { PLATFORM_ADMIN_ROLES } from "@/lib/auth";

export type Permission =
  | "organization:view"
  | "organization:update"
  | "membership:view"
  | "membership:manage"
  | "billing:view"
  | "developer:view"
  | "audit:view"
  | "admin:access"
  | "rbac:manage"
  | "countries:manage"
  | "feature_flags:manage"
  | "api_management:read"
  | "api_management:manage"
  | "api_management:manage_secrets"
  | "api_management:test"
  | "api_management:disable"
  | "api_management:rotate_credentials"
  | "settings:manage"
  | "users:manage"
  | "billing:manage"
  | "payments:manage"
  | "payments:configure"
  | "storage:manage"
  | "storage:configure"
  | "verification:manage"
  | "kyc:manage"
  | "support:manage"
  | "reports:view"
  | "marketplace:manage";

const platformPermissionMap: Partial<Record<PlatformRole, Permission[]>> = {
  platform_owner: [
    "admin:access",
    "countries:manage",
    "feature_flags:manage",
    "api_management:read",
    "api_management:manage",
    "api_management:manage_secrets",
    "api_management:test",
    "api_management:disable",
    "api_management:rotate_credentials",
    "settings:manage",
    "audit:view",
    "rbac:manage",
    "users:manage",
    "billing:manage",
    "payments:manage",
    "payments:configure",
    "storage:manage",
    "storage:configure",
    "verification:manage",
    "kyc:manage",
    "support:manage",
    "reports:view",
    "marketplace:manage",
  ],
  platform_admin: [
    "admin:access",
    "countries:manage",
    "feature_flags:manage",
    "api_management:read",
    "settings:manage",
    "audit:view",
    "users:manage",
    "billing:manage",
    "payments:manage",
    "storage:manage",
    "verification:manage",
    "kyc:manage",
    "support:manage",
    "reports:view",
    "marketplace:manage",
  ],
  country_manager: ["admin:access", "countries:manage", "audit:view", "users:manage", "reports:view", "marketplace:manage"],
  support_admin: ["admin:access", "audit:view", "users:manage", "support:manage", "verification:manage", "kyc:manage"],
  auditor: ["admin:access", "audit:view", "reports:view"],
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
  household_member: ["organization:view"],
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
  home_catering_owner: [
    "organization:view",
    "organization:update",
    "membership:view",
    "membership:manage",
    "billing:view",
    "developer:view",
    "audit:view",
  ],
  home_catering_staff: ["organization:view", "membership:view"],
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

export function canAccessPlatformAdmin(params: {
  platformRole?: PlatformRole | null;
}) {
  return !!params.platformRole && PLATFORM_ADMIN_ROLES.includes(params.platformRole);
}
