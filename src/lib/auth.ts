import type {
  CountryAssignment,
  Membership,
  Organization,
  OrganizationRole,
  OrganizationStatus,
  PlatformRole,
  User,
  UserStatus,
} from "@prisma/client";

export class AccessDeniedError extends Error {
  constructor(
    message: string,
    readonly code:
      | "UNAUTHENTICATED"
      | "USER_INACTIVE"
      | "ORGANIZATION_INACTIVE"
      | "MEMBERSHIP_REQUIRED"
      | "ROLE_REQUIRED"
      | "COUNTRY_ACCESS_REQUIRED",
  ) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export const PLATFORM_ADMIN_ROLES: PlatformRole[] = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
  "auditor",
];

export const FULL_PLATFORM_ADMIN_ROLES: PlatformRole[] = [
  "platform_owner",
  "platform_admin",
];

export const ACTIVE_USER_STATUSES: UserStatus[] = ["active"];
export const ACCESSIBLE_ORGANIZATION_STATUSES: OrganizationStatus[] = ["active", "paused"];

export type SessionLike = {
  user: Pick<User, "id" | "email" | "status" | "platformRole">;
  activeMembership?: Pick<Membership, "organizationId" | "role" | "status"> | null;
  activeOrganization?: Pick<Organization, "id" | "countryCode" | "status"> | null;
  countryAssignments?: Array<Pick<CountryAssignment, "countryCode">>;
};

export function isUserActive(status: UserStatus) {
  return ACTIVE_USER_STATUSES.includes(status);
}

export function assertUserCanAuthenticate(user: Pick<User, "status">) {
  if (!isUserActive(user.status)) {
    throw new AccessDeniedError("User account is not active.", "USER_INACTIVE");
  }
}

export function assertOrganizationIsAccessible(
  organization: Pick<Organization, "status"> | null | undefined,
) {
  if (!organization || !ACCESSIBLE_ORGANIZATION_STATUSES.includes(organization.status)) {
    throw new AccessDeniedError(
      "Organization is not in an accessible state.",
      "ORGANIZATION_INACTIVE",
    );
  }
}

export function hasPlatformRole(
  platformRole: PlatformRole | null | undefined,
  roles: PlatformRole[],
) {
  return !!platformRole && roles.includes(platformRole);
}

export function assertPlatformRole(
  platformRole: PlatformRole | null | undefined,
  roles: PlatformRole[],
) {
  if (!hasPlatformRole(platformRole, roles)) {
    throw new AccessDeniedError("Platform role is required.", "ROLE_REQUIRED");
  }
}

export function hasOrganizationRole(
  role: OrganizationRole | null | undefined,
  roles: OrganizationRole[],
) {
  return !!role && roles.includes(role);
}

export function assertMembershipAccess(session: SessionLike, organizationId?: string) {
  const membership = session.activeMembership;
  const organization = session.activeOrganization;

  if (!membership || !organization) {
    throw new AccessDeniedError("Active membership is required.", "MEMBERSHIP_REQUIRED");
  }

  if (organizationId && membership.organizationId !== organizationId) {
    throw new AccessDeniedError("Cross-tenant access denied.", "MEMBERSHIP_REQUIRED");
  }

  assertOrganizationIsAccessible(organization);

  return membership;
}

export function assertOrganizationRole(session: SessionLike, roles: OrganizationRole[]) {
  const membership = assertMembershipAccess(session);

  if (!hasOrganizationRole(membership.role, roles)) {
    throw new AccessDeniedError("Organization role is required.", "ROLE_REQUIRED");
  }

  return membership;
}

export function assertCountryAccess(session: SessionLike, countryCode: string) {
  const platformRole = session.user.platformRole;

  if (platformRole === "platform_owner" || platformRole === "platform_admin") {
    return true;
  }

  if (platformRole !== "country_manager") {
    throw new AccessDeniedError(
      "Country-level access is not permitted for this user.",
      "COUNTRY_ACCESS_REQUIRED",
    );
  }

  const assignedCountryCodes = (session.countryAssignments ?? []).map(
    (assignment) => assignment.countryCode,
  );

  if (!assignedCountryCodes.includes(countryCode)) {
    throw new AccessDeniedError(
      "Country is not assigned to this manager.",
      "COUNTRY_ACCESS_REQUIRED",
    );
  }

  return true;
}

export function canAccessPlatformAdmin(session: SessionLike) {
  return hasPlatformRole(session.user.platformRole, PLATFORM_ADMIN_ROLES);
}
