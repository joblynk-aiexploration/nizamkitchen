import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    billingUsageRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    billingSubscription: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn().mockResolvedValue({}) }));

import { getCurrentUsage } from "../../src/server/billing/entitlements";
import { getUsageForPeriod } from "../../src/server/billing/usage";
import { getLastMonthlyResetAt, recordMonthlyReset } from "../../src/server/billing/limit-overrides";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG = "org-household-1";

function calendarMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
  // No active subscription → getCurrentUsage still runs via direct imports
  // (getCurrentUsage does not call getEntitlement; it only needs usage DB calls)
  mockPrisma.billingSubscription.findFirst.mockResolvedValue(null);
});

// ─── getUsageForPeriod: since parameter ───────────────────────────────────────

describe("getUsageForPeriod", () => {
  const periodStart = new Date("2026-08-01T00:00:00.000Z");
  const periodEnd   = new Date("2026-08-31T23:59:59.999Z");

  it("omits createdAt filter when since is not provided", async () => {
    mockPrisma.billingUsageRecord.aggregate.mockResolvedValue({ _sum: { quantity: 7 } });

    const count = await getUsageForPeriod(ORG, "meal_plan_created", periodStart, periodEnd);

    expect(count).toBe(7);
    expect(mockPrisma.billingUsageRecord.aggregate).toHaveBeenCalledWith({
      where: {
        organizationId: ORG,
        usageType: "meal_plan_created",
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      _sum: { quantity: true },
    });
  });

  it("adds createdAt >= since filter when since is provided", async () => {
    const since = new Date("2026-08-05T10:00:00.000Z");
    mockPrisma.billingUsageRecord.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });

    const count = await getUsageForPeriod(ORG, "meal_plan_created", periodStart, periodEnd, since);

    expect(count).toBe(3);
    expect(mockPrisma.billingUsageRecord.aggregate).toHaveBeenCalledWith({
      where: {
        organizationId: ORG,
        usageType: "meal_plan_created",
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        createdAt: { gte: since },
      },
      _sum: { quantity: true },
    });
  });

  it("returns 0 when aggregate sum is null (no records)", async () => {
    mockPrisma.billingUsageRecord.aggregate.mockResolvedValue({ _sum: { quantity: null } });

    const count = await getUsageForPeriod(ORG, "grocery_list_created", periodStart, periodEnd);
    expect(count).toBe(0);
  });
});

// ─── getCurrentUsage: reset behavior ─────────────────────────────────────────

describe("getCurrentUsage — admin monthly reset", () => {
  it("counts from calendar month start when no reset exists", async () => {
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue(null); // no reset
    mockPrisma.billingUsageRecord.aggregate.mockResolvedValue({ _sum: { quantity: 5 } });

    const usage = await getCurrentUsage(ORG);

    expect(usage.mealPlansThisMonth).toBe(5);
    expect(usage.groceryListsThisMonth).toBe(5);
    expect(usage.chefRequestsThisMonth).toBe(5);

    // All three aggregates are called without a createdAt filter
    for (const [arg] of mockPrisma.billingUsageRecord.aggregate.mock.calls) {
      expect(arg.where).not.toHaveProperty("createdAt");
    }
  });

  it("uses reset timestamp as createdAt lower-bound when reset occurred this month", async () => {
    const resetAt = new Date("2026-08-05T10:00:00.000Z");
    // getLastMonthlyResetAt calls findFirst with usageType = "admin_monthly_reset"
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue({ createdAt: resetAt });
    mockPrisma.billingUsageRecord.aggregate
      .mockResolvedValueOnce({ _sum: { quantity: 1 } }) // mealPlans
      .mockResolvedValueOnce({ _sum: { quantity: 0 } }) // groceryLists
      .mockResolvedValueOnce({ _sum: { quantity: 2 } }); // chefRequests

    const usage = await getCurrentUsage(ORG);

    expect(usage.mealPlansThisMonth).toBe(1);
    expect(usage.groceryListsThisMonth).toBe(0);
    expect(usage.chefRequestsThisMonth).toBe(2);

    // All three aggregates must carry createdAt: { gte: resetAt }
    expect(mockPrisma.billingUsageRecord.aggregate).toHaveBeenCalledTimes(3);
    for (const [arg] of mockPrisma.billingUsageRecord.aggregate.mock.calls) {
      expect(arg.where).toMatchObject({ createdAt: { gte: resetAt } });
    }
  });

  it("covers all three metric types: meal plans, grocery lists, chef requests", async () => {
    const resetAt = new Date("2026-08-10T09:00:00.000Z");
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue({ createdAt: resetAt });
    mockPrisma.billingUsageRecord.aggregate
      .mockResolvedValueOnce({ _sum: { quantity: 2 } })
      .mockResolvedValueOnce({ _sum: { quantity: 4 } })
      .mockResolvedValueOnce({ _sum: { quantity: 1 } });

    const usage = await getCurrentUsage(ORG);
    expect(usage.mealPlansThisMonth).toBe(2);
    expect(usage.groceryListsThisMonth).toBe(4);
    expect(usage.chefRequestsThisMonth).toBe(1);

    const usageTypes = (mockPrisma.billingUsageRecord.aggregate.mock.calls as Array<[{ where: { usageType: string } }]>).map(
      ([arg]) => arg.where.usageType,
    );
    expect(usageTypes).toContain("meal_plan_created");
    expect(usageTypes).toContain("grocery_list_created");
    expect(usageTypes).toContain("chef_request_submitted");
  });

  it("does not apply createdAt filter when reset timestamp equals month start", async () => {
    // Edge case: reset exactly at calendar month start — same as no reset
    const monthStart = calendarMonthStart();
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue({ createdAt: monthStart });
    mockPrisma.billingUsageRecord.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });

    await getCurrentUsage(ORG);

    // Since resetAt === periodStart, it is NOT strictly > periodStart → since = undefined
    for (const [arg] of mockPrisma.billingUsageRecord.aggregate.mock.calls) {
      expect(arg.where).not.toHaveProperty("createdAt");
    }
  });

  it("treats null aggregate sum as zero even after a reset", async () => {
    const resetAt = new Date("2026-08-12T08:00:00.000Z");
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue({ createdAt: resetAt });
    mockPrisma.billingUsageRecord.aggregate.mockResolvedValue({ _sum: { quantity: null } });

    const usage = await getCurrentUsage(ORG);
    expect(usage.mealPlansThisMonth).toBe(0);
    expect(usage.groceryListsThisMonth).toBe(0);
    expect(usage.chefRequestsThisMonth).toBe(0);
  });
});

// ─── getLastMonthlyResetAt: query behavior ────────────────────────────────────

describe("getLastMonthlyResetAt", () => {
  it("returns null when no reset record exists for the current month", async () => {
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue(null);
    const result = await getLastMonthlyResetAt(ORG);
    expect(result).toBeNull();
  });

  it("returns createdAt of the most recent reset record", async () => {
    const resetAt = new Date("2026-08-07T14:30:00.000Z");
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue({ createdAt: resetAt });
    const result = await getLastMonthlyResetAt(ORG);
    expect(result).toEqual(resetAt);
  });

  it("queries only for admin_monthly_reset type and current month", async () => {
    mockPrisma.billingUsageRecord.findFirst.mockResolvedValue(null);
    await getLastMonthlyResetAt(ORG);

    const [{ where }] = mockPrisma.billingUsageRecord.findFirst.mock.calls[0];
    expect(where.organizationId).toBe(ORG);
    expect(where.usageType).toBe("admin_monthly_reset");
    expect(where.periodStart).toMatchObject({ gte: expect.any(Date) });
    const periodStartGte: Date = where.periodStart.gte;
    // The lower-bound must be the first day of the current month
    expect(periodStartGte.getDate()).toBe(1);
    expect(periodStartGte.getMonth()).toBe(new Date().getMonth());
    expect(periodStartGte.getFullYear()).toBe(new Date().getFullYear());
  });
});

// ─── recordMonthlyReset: write behavior ──────────────────────────────────────

describe("recordMonthlyReset", () => {
  it("creates a billing usage record with usageType admin_monthly_reset", async () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    mockPrisma.billingUsageRecord.create.mockResolvedValue({ id: "reset-1", createdAt: now });

    await recordMonthlyReset(ORG);

    expect(mockPrisma.billingUsageRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG,
          usageType: "admin_monthly_reset",
          quantity: 0,
        }),
      }),
    );
  });

  it("returns the timestamp of the new reset record", async () => {
    const now = new Date("2026-08-06T12:00:00.000Z");
    vi.setSystemTime(now);
    mockPrisma.billingUsageRecord.create.mockResolvedValue({ id: "reset-1", createdAt: now });

    const result = await recordMonthlyReset(ORG);
    // Should be close to now
    expect(result.getTime()).toBeCloseTo(now.getTime(), -3);

    vi.useRealTimers();
  });
});
