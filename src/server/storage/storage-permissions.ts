import type { PlatformRole, StorageFile, UserStatus } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";

export type StorageSession = {
  user: { id: string; status: UserStatus; platformRole: PlatformRole | null };
  activeOrganization?: { id: string; countryCode: string; organizationType: string } | null;
  activeMembership?: { role: string; status: string } | null;
  countryAssignments?: Array<{ countryCode: string }>;
};

const STORAGE_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];
const STORAGE_VIEW_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin", "auditor", "country_manager"];

export function assertStorageAdmin(session: StorageSession) {
  assertPlatformRole(session.user.platformRole, STORAGE_ADMIN_ROLES);
}

export function assertStorageMetadataViewer(session: StorageSession) {
  assertPlatformRole(session.user.platformRole, STORAGE_VIEW_ROLES);
}

export function canAccessStorageFile(session: StorageSession, file: Pick<StorageFile, "organizationId" | "uploadedById" | "visibility" | "status" | "countryCode">) {
  if (file.status === "deleted" || file.status === "quarantined") return false;
  if (file.visibility === "public") return true;
  if (session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin" || session.user.platformRole === "support_admin") return true;
  if (session.user.platformRole === "country_manager") {
    const assigned = session.countryAssignments?.map((assignment) => assignment.countryCode) ?? [];
    return Boolean(file.countryCode && assigned.includes(file.countryCode));
  }
  if (file.uploadedById === session.user.id) return true;
  if (file.visibility === "organization" || file.visibility === "private") {
    return Boolean(file.organizationId && session.activeOrganization?.id === file.organizationId);
  }
  return false;
}
