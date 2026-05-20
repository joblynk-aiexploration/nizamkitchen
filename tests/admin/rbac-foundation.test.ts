import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    permission: {
      findMany: vi.fn(),
    },
    rolePermission: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    userPermissionOverride: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { AccessDeniedError } from "../../src/lib/auth";
import { hasPermission, requirePermission, canManageUser } from "../../src/server/rbac/permission-service";
import { listRoleAccessMatrix } from "../../src/server/rbac/role-service";

const ownerSession = {
  user: { id: "owner-1", email: "platform-owner@example.test", status: "active" as const, platformRole: "platform_owner" as const },
  activeMembership: null,
  activeOrganization: null,
  countryAssignments: [],
};

const adminSession = {
  user: { id: "admin-1", email: "platform-admin@example.test", status: "active" as const, platformRole: "platform_admin" as const },
  activeMembership: null,
  activeOrganization: null,
  countryAssignments: [],
};

describe("RBAC foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.userPermissionOverride.findFirst.mockResolvedValue(null);
    mockPrisma.rolePermission.findFirst.mockResolvedValue(null);
    mockPrisma.permission.findMany.mockResolvedValue([]);
    mockPrisma.rolePermission.findMany.mockResolvedValue([]);
    mockPrisma.userPermissionOverride.findMany.mockResolvedValue([]);
  });

  it("grants platform owner full default access", async () => {
    await expect(requirePermission(ownerSession as never, "rbac.manage")).resolves.toBeUndefined();
    expect(await hasPermission(ownerSession as never, "payments.configure")).toBe(true);
  });

  it("does not grant platform admin sensitive credential configuration by default", async () => {
    expect(await hasPermission(adminSession as never, "payments.configure")).toBe(false);
    expect(await hasPermission(adminSession as never, "payments.manage")).toBe(true);
  });

  it("honors explicit deny overrides over role defaults", async () => {
    mockPrisma.userPermissionOverride.findFirst.mockResolvedValueOnce({ effect: "deny" });
    await expect(requirePermission(ownerSession as never, "payments.manage")).rejects.toThrow(AccessDeniedError);
  });

  it("protects platform owner from platform admin user management", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ platformRole: "platform_owner" });
    await expect(canManageUser(adminSession as never, "owner-1")).resolves.toBe(false);
  });

  it("builds an access matrix from fallback catalog when DB is empty", async () => {
    const matrix = await listRoleAccessMatrix();
    expect(matrix.permissions.length).toBeGreaterThan(0);
    expect(matrix.platformRoles.find((role) => role.role === "platform_owner")?.permissions.size).toBeGreaterThan(0);
  });
});
