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
    auditLog: { findMany: vi.fn(), create: vi.fn() },
    storageConfiguration: { count: vi.fn(), findMany: vi.fn() },
    paymentGateway: { count: vi.fn() },
    paymentWebhookEvent: { count: vi.fn(), findMany: vi.fn() },
    paymentOrder: { count: vi.fn(), findMany: vi.fn() },
    paymentRefund: { count: vi.fn() },
    kycProviderConfiguration: { count: vi.fn() },
    platformIntegration: { findMany: vi.fn() },
    systemAlert: { count: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

describe("operations health check", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 1 }]);
    mockPrisma.paymentGateway.count.mockResolvedValue(0);
    mockPrisma.paymentWebhookEvent.count.mockResolvedValue(0);
    mockPrisma.paymentOrder.count.mockResolvedValue(0);
    mockPrisma.paymentRefund.count.mockResolvedValue(0);
    mockPrisma.platformIntegration.findMany.mockResolvedValue([]);
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

  it("/api/health/payments returns payment health without exposing secrets", async () => {
    const { GET } = await import("../../src/app/api/health/payments/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.payments.failedWebhooks).toBe(0);
    expect(JSON.stringify(body)).not.toMatch(/STRIPE_SECRET_KEY|PAYPAL_CLIENT_SECRET|sk_live|sk_test|password|secret/i);
  });

  it("/api/health/integrations reports optional integrations as configured booleans", async () => {
    mockPrisma.storageConfiguration.count.mockResolvedValue(0);
    mockPrisma.kycProviderConfiguration.count.mockResolvedValue(0);

    const { GET } = await import("../../src/app/api/health/integrations/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.integrations.mapTiler.configured).toBe(false);
    expect(body.integrations.youtube.configured).toBe(false);
    expect(body.integrations.smtp.configured).toBe(false);
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
    mockPrisma.storageConfiguration.count.mockResolvedValue(0);
    mockPrisma.storageConfiguration.findMany.mockResolvedValue([]);
    mockPrisma.paymentGateway.count.mockResolvedValue(0);
    mockPrisma.paymentWebhookEvent.count.mockResolvedValue(0);
    mockPrisma.paymentWebhookEvent.findMany.mockResolvedValue([]);
    mockPrisma.paymentOrder.count.mockResolvedValue(0);
    mockPrisma.paymentOrder.findMany.mockResolvedValue([]);
    mockPrisma.kycProviderConfiguration.count.mockResolvedValue(0);
    mockPrisma.platformIntegration.findMany.mockResolvedValue([]);
    mockPrisma.systemAlert.count.mockResolvedValue(0);
    mockPrisma.systemAlert.findMany.mockResolvedValue([]);
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
    expect(status.integrations.mapTiler.configured).toBe(false);
    expect(status.integrations.youtube.configured).toBe(false);
    expect(status.integrations.stripe.configured).toBe(false);
    expect(status.alerts.open).toBe(0);
    expect(JSON.stringify(status)).not.toContain(process.env.SESSION_SECRET);
    expect(JSON.stringify(status)).not.toContain(process.env.DATABASE_URL);
  });

  it("blocks household users from system status", async () => {
    const { getAdminSystemStatus } = await import("../../src/server/admin/system-status");

    await expect(getAdminSystemStatus({ user: { platformRole: null } })).rejects.toThrow("Platform role is required.");
  });
});

describe("system alerts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("creates sanitized system alerts", async () => {
    mockPrisma.systemAlert.create.mockResolvedValue({
      id: "alert-1",
      type: "storage_test_failure",
      severity: "warning",
      status: "open",
      title: "Storage test failed",
      message: "Storage test failed: secret=[redacted]",
      metadataJson: { accessKey: "[redacted]" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { createSystemAlertForFailure } = await import("../../src/server/observability/system-alerts");
    const alert = await createSystemAlertForFailure({
      type: "storage_test_failure",
      title: "Storage test failed",
      message: "Storage test failed: secret=super-secret",
      metadataJson: { accessKey: "AKIA1234567890123456" },
    });

    expect(alert?.id).toBe("alert-1");
    expect(mockPrisma.systemAlert.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        message: "Storage test failed: secret=[redacted]",
        metadataJson: expect.objectContaining({ accessKey: "[redacted_aws_access_key]" }),
      }),
    }));
  });

  it("resolves alerts and writes an audit event", async () => {
    mockPrisma.systemAlert.update.mockResolvedValue({
      id: "alert-1",
      type: "payment_webhook_failure",
      severity: "critical",
      status: "resolved",
    });

    const { updateSystemAlertStatus } = await import("../../src/server/observability/system-alerts");
    await updateSystemAlertStatus({ user: { id: "owner-1", platformRole: "platform_owner" } }, "alert-1", "resolved");

    expect(mockPrisma.systemAlert.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "alert-1" },
      data: expect.objectContaining({ status: "resolved", resolvedById: "owner-1" }),
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "system_alert.resolved", targetType: "system_alert" }),
    }));
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
