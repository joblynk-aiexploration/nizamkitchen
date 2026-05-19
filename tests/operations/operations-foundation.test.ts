import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test";
process.env.SESSION_SECRET ??= "test-session-secret-with-more-than-32-characters";
process.env.APP_URL ??= "http://localhost:3000";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    featureFlag: { count: vi.fn() },
    user: { count: vi.fn() },
    organization: { count: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

describe("operations health check", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 1 }]);
  });

  it("/api/health returns safe JSON when database and migrations are reachable", async () => {
    const { GET } = await import("../../src/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.database).toBe("reachable");
    expect(body.migrations).toBe("reachable");
    expect(JSON.stringify(body)).not.toMatch(/DATABASE_URL|SESSION_SECRET|password|api[_-]?key/i);
  });
});

describe("admin system status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 1 }]);
    mockPrisma.featureFlag.count.mockResolvedValue(8);
    mockPrisma.user.count.mockResolvedValue(12);
    mockPrisma.organization.count.mockResolvedValue(4);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-1",
        action: "feature_flag.updated",
        targetType: "feature_flag",
        countryCode: null,
        createdAt: new Date("2026-05-19T12:00:00.000Z"),
      },
    ]);
  });

  it("allows platform admins to read safe system status", async () => {
    const { getAdminSystemStatus } = await import("../../src/server/admin/system-status");
    const status = await getAdminSystemStatus({ user: { platformRole: "platform_admin" } });

    expect(status.counts).toEqual({ featureFlags: 8, users: 12, organizations: 4 });
    expect(status.database).toEqual({ reachable: true, migrationsReachable: true });
    expect(status.integrations.mapTiler).toBe(false);
    expect(status.integrations.youtube).toBe(false);
    expect(status.integrations.stripe).toBe(false);
    expect(JSON.stringify(status)).not.toContain(process.env.SESSION_SECRET);
    expect(JSON.stringify(status)).not.toContain(process.env.DATABASE_URL);
  });

  it("blocks household users from system status", async () => {
    const { getAdminSystemStatus } = await import("../../src/server/admin/system-status");

    await expect(getAdminSystemStatus({ user: { platformRole: null } })).rejects.toThrow("Platform role is required.");
  });
});

describe("operations scripts", () => {
  const repoRoot = process.cwd();

  it("backup scripts exist and are executable", () => {
    for (const script of [
      "scripts/ops/backup-postgres.sh",
      "scripts/ops/restore-postgres.sh",
      "scripts/ops/list-backups.sh",
    ]) {
      const absolutePath = `${repoRoot}/${script}`;
      const stat = fs.statSync(absolutePath);
      expect(stat.isFile()).toBe(true);
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    }
  });

  it("backup directory is gitignored", () => {
    const gitignore = fs.readFileSync(`${repoRoot}/.gitignore`, "utf8");
    expect(gitignore).toContain("/backups");
    expect(gitignore).toContain("*.dump");
  });
});
