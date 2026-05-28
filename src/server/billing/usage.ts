import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

export type UsageType =
  | "meal_plan_created"
  | "grocery_list_created"
  | "grocery_list_exported"
  | "chef_request_submitted"
  | "restaurant_search";

export async function recordUsage(params: {
  organizationId: string;
  usageType: UsageType;
  quantity?: number;
  periodStart: Date;
  periodEnd: Date;
  actorUserId?: string | null;
}) {
  const record = await prisma.billingUsageRecord.create({
    data: {
      organizationId: params.organizationId,
      usageType: params.usageType,
      quantity: params.quantity ?? 1,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId ?? null,
    organizationId: params.organizationId,
    action: "billing_usage.recorded",
    targetType: "billing_usage_record",
    targetId: record.id,
    details: { usageType: params.usageType, quantity: record.quantity },
  });

  return record;
}

export async function getUsageForPeriod(
  organizationId: string,
  usageType: UsageType,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const result = await prisma.billingUsageRecord.aggregate({
    where: { organizationId, usageType, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function listUsageRecords(organizationId: string, limit = 50) {
  return prisma.billingUsageRecord.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function currentBillingPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
}
