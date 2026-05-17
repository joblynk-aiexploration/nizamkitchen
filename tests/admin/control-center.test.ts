import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, recordAdminAuditLog } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    organization: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    country: {
      count: vi.fn(),
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

import { AccessDeniedError } from "../../src/lib/auth";
import { getAdminDashboardData } from "../../src/server/admin/dashboard";
import { updateCountry } from "../../src/server/admin/countries";
import { updateFeatureFlag } from "../../src/server/admin/feature-flags";
import { updateOrganizationStatus } from "../../src/server/admin/organizations";
import { updateSystemSetting } from "../../src/server/admin/system-settings";

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
      email: "admin@nizamkitchen.dev",
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
    mockPrisma.organization.count.mockResolvedValue(3);
    mockPrisma.country.count.mockResolvedValue(2);
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
            email: "orgadmin@nizamkitchen.dev",
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
            email: "country@nizamkitchen.dev",
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
            email: "country@nizamkitchen.dev",
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
});
