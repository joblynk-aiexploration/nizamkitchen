import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, recordAdminAuditLog } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    organization: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    country: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      groupBy: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    featureFlag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    billingSubscription: {
      findMany: vi.fn(),
    },
    countryAssignment: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    systemSetting: {
      upsert: vi.fn(),
    },
  },
  recordAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/server/audit/audit-service", () => ({
  recordAdminAuditLog,
  getAuditSeverity: (action: string) => (action === "access.denied" ? "warning" : "info"),
}));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hashed-password") }));

import { AccessDeniedError } from "../../src/lib/auth";
import { listAdminAuditLogs } from "../../src/server/admin/audit-logs";
import { getAdminDashboardData } from "../../src/server/admin/dashboard";
import { updateCountry } from "../../src/server/admin/countries";
import { updateFeatureFlag } from "../../src/server/admin/feature-flags";
import { updateOrganizationStatus } from "../../src/server/admin/organizations";
import { updateSystemSetting } from "../../src/server/admin/system-settings";
import { createAdminUser, getAdminUserDetail, listAdminUsers } from "../../src/server/admin/users";

type AdminSession = Parameters<typeof getAdminDashboardData>[0];

function buildSession(overrides?: Partial<{
  user: {
    id: string;
    email: string;
    status: "active";
    platformRole: "platform_admin" | "platform_owner" | "country_manager" | null;
  };
  countryAssignments: Array<{ id: string; createdAt: Date; userId: string; countryCode: string }>;
}>): AdminSession {
  return {
    id: "session-1",
    tokenHash: "hash",
    userId: "user-1",
    activeOrganizationId: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
    sessionToken: "session-token",
    memberships: [],
    user: {
      id: "user-1",
      email: "platform-admin@example.test",
      status: "active" as const,
      platformRole: "platform_admin" as const,
      ...overrides?.user,
    },
    activeMembership: null,
    activeOrganization: null,
    countryAssignments: overrides?.countryAssignments ?? [],
  } as unknown as AdminSession;
}

describe("admin control center permissions and auditing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.user.count.mockResolvedValue(10);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(async ({ data }) => ({ id: "new-user-1", ...data }));
    mockPrisma.organization.count.mockResolvedValue(3);
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.country.count.mockResolvedValue(2);
    mockPrisma.country.findMany.mockResolvedValue([{ countryCode: "US" }]);
    mockPrisma.auditLog.count.mockResolvedValue(1);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.organization.findMany.mockResolvedValue([]);
    mockPrisma.organization.groupBy.mockResolvedValue([]);
    mockPrisma.user.groupBy.mockResolvedValue([]);
    mockPrisma.membership.groupBy.mockResolvedValue([]);
    mockPrisma.featureFlag.findMany.mockResolvedValue([]);
    mockPrisma.billingSubscription.findMany.mockResolvedValue([]);
  });

  it("allows a platform admin to load the admin dashboard", async () => {
    const result = await getAdminDashboardData(buildSession());

    expect(result.totalUsers).toBe(10);
    expect(mockPrisma.user.count).toHaveBeenCalled();
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it("paginates the full admin audit log page", async () => {
    const createdAt = new Date("2026-05-26T12:00:00.000Z");
    mockPrisma.auditLog.count.mockResolvedValue(61);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-26",
        action: "user.updated",
        targetType: "user",
        targetId: "user-1",
        actorUserId: "admin-1",
        organizationId: null,
        countryCode: "US",
        details: {},
        ipAddress: null,
        userAgent: null,
        createdAt,
      },
    ]);

    const result = await listAdminAuditLogs(buildSession(), { page: "2" });

    expect(mockPrisma.auditLog.count).toHaveBeenCalled();
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(result.pagination).toMatchObject({
      page: 2,
      pageSize: 10,
      totalLogs: 61,
      totalPages: 7,
      hasPreviousPage: true,
      hasNextPage: true,
    });
    expect(result.logs).toHaveLength(1);
  });

  it("prevents a regular organization user from accessing the admin dashboard", async () => {
    await expect(
      getAdminDashboardData(
        buildSession({
          user: {
            id: "user-2",
            email: "member@nizamkitchen.dev",
            status: "active",
            platformRole: null,
          },
        }),
      ),
    ).rejects.toThrow(AccessDeniedError);
  });

  it("prevents an organization admin from calling platform admin mutations", async () => {
    await expect(
      updateOrganizationStatus(
        buildSession({
          user: {
            id: "user-3",
            email: "org-admin@example.test",
            status: "active",
            platformRole: null,
          },
        }),
        "org-1",
        { status: "suspended" },
      ),
    ).rejects.toThrow(AccessDeniedError);
  });

  it("allows a country manager to manage an assigned country only", async () => {
    mockPrisma.country.update.mockResolvedValue({
      countryCode: "US",
      defaultTimezone: "America/Chicago",
      defaultLocale: "en-US",
      measurementSystem: "imperial",
      phoneCountryCode: "+1",
      supportedModules: [],
    });

    await expect(
      updateCountry(
        buildSession({
          user: {
            id: "user-country",
            email: "country-manager@example.test",
            status: "active",
            platformRole: "country_manager",
          },
          countryAssignments: [
            { id: "assignment-1", createdAt: new Date(), userId: "user-country", countryCode: "US" },
          ],
        }),
        "US",
        {
          defaultTimezone: "America/Chicago",
          defaultLocale: "en-US",
          measurementSystem: "imperial",
          phoneCountryCode: "+1",
          supportedModules: [],
        },
      ),
    ).resolves.toBeTruthy();

    await expect(
      updateCountry(
        buildSession({
          user: {
            id: "user-country",
            email: "country-manager@example.test",
            status: "active",
            platformRole: "country_manager",
          },
          countryAssignments: [
            { id: "assignment-1", createdAt: new Date(), userId: "user-country", countryCode: "US" },
          ],
        }),
        "IN",
        {
          defaultTimezone: "Asia/Kolkata",
          defaultLocale: "en-IN",
          measurementSystem: "metric",
          phoneCountryCode: "+91",
          supportedModules: [],
        },
      ),
    ).rejects.toThrow(AccessDeniedError);
  });

  it("creates an audit log when organization status changes", async () => {
    mockPrisma.organization.update.mockResolvedValue({
      id: "org-1",
      countryCode: "US",
      status: "suspended",
    });

    await updateOrganizationStatus(buildSession(), "org-1", {
      status: "suspended",
      reason: "Security review",
    });

    expect(recordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.updated",
        targetId: "org-1",
      }),
    );
  });

  it("creates an audit log when a feature flag changes", async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue({
      id: "flag-1",
      key: "recipes",
      name: "Recipes",
      description: null,
      enabled: false,
      countryCode: null,
      organizationId: null,
    });
    mockPrisma.featureFlag.update.mockResolvedValue({
      id: "flag-1",
      enabled: true,
    });

    await updateFeatureFlag(buildSession(), "flag-1", {
      enabled: true,
      scopeType: "global",
    });

    expect(recordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "feature_flag.updated",
        targetId: "flag-1",
      }),
    );
  });

  it("creates an audit log when a system setting changes", async () => {
    mockPrisma.systemSetting.upsert.mockResolvedValue({
      id: "setting-1",
      key: "platform.name",
    });

    await updateSystemSetting(buildSession(), {
      key: "platform.name",
      value: "NizamKitchen",
      description: "Platform name",
    });

    expect(recordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "setting.updated",
        targetId: "platform.name",
      }),
    );
  });

  it("allows a platform admin to create a user with membership and country access", async () => {
    const user = await createAdminUser(buildSession(), {
      fullName: "Support User",
      email: "support@example.test",
      password: "Vitest#2026!",
      status: "active",
      platformRole: "support_admin",
      organizationId: "org-1",
      organizationRole: "org_admin",
      countryCodes: ["US"],
    });

    expect(user.id).toBe("new-user-1");
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "support@example.test",
        passwordHash: "hashed-password",
        platformRole: "support_admin",
        memberships: expect.objectContaining({
          create: expect.objectContaining({ organizationId: "org-1", role: "org_admin" }),
        }),
        countryAssignments: expect.objectContaining({
          create: [{ countryCode: "US" }],
        }),
      }),
    }));
    expect(recordAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "user.created" }));
  });

  it("hides safe-deleted users from platform user management", async () => {
    mockPrisma.user.count.mockResolvedValueOnce(0);
    mockPrisma.user.findMany.mockResolvedValueOnce([]);

    const result = await listAdminUsers(buildSession({ user: { id: "owner-1", email: "owner@example.test", status: "active", platformRole: "platform_owner" } }), {
      search: "Deleted User",
    });

    expect(result.items).toEqual([]);
    const where = mockPrisma.user.count.mock.calls.at(-1)?.[0]?.where;
    expect(where).toMatchObject({
      AND: expect.arrayContaining([
        expect.objectContaining({
          NOT: expect.arrayContaining([
            expect.objectContaining({ email: expect.objectContaining({ endsWith: "@nizamkitchen.deleted" }) }),
            expect.objectContaining({ email: expect.objectContaining({ endsWith: "@nizamkitchen.invalid" }) }),
          ]),
        }),
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ email: expect.objectContaining({ contains: "Deleted User" }) }),
            expect.objectContaining({ fullName: expect.objectContaining({ contains: "Deleted User" }) }),
          ]),
        }),
      ]),
    });
  });

  it("treats safe-deleted user detail routes as not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "deleted-user-1",
      email: "deleted-user-1@nizamkitchen.deleted",
      fullName: "Deleted User",
      status: "disabled",
      platformRole: null,
      memberships: [],
      countryAssignments: [],
      sessions: [],
      oauthAccounts: [],
      auditLogs: [],
    });

    await expect(
      getAdminUserDetail(
        buildSession({ user: { id: "owner-1", email: "owner@example.test", status: "active", platformRole: "platform_owner" } }),
        "deleted-user-1",
      ),
    ).rejects.toThrow("User not found.");
  });

  it("prevents platform admins from creating another platform owner", async () => {
    await expect(createAdminUser(buildSession(), {
      fullName: "Owner Two",
      email: "owner2@example.test",
      password: "Vitest#2026!",
      platformRole: "platform_owner",
      countryCodes: [],
    })).rejects.toThrow("Only the platform owner");
  });
});
