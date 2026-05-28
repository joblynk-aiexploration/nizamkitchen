import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BillingReadinessIssue =
  | "billing_delegate_missing"
  | "billing_schema_missing"
  | "billing_query_failed";

export type BillingAdminSummary = {
  planCount: number;
  subscriptionCount: number;
  statusCounts: Record<string, number>;
  ready: boolean;
  issue?: BillingReadinessIssue;
  message?: string;
};

function isMissingBillingSchemaError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export function getBillingDelegates() {
  const client = prisma as typeof prisma & {
    billingPlan?: typeof prisma.billingPlan;
    billingSubscription?: typeof prisma.billingSubscription;
    billingUsageRecord?: typeof prisma.billingUsageRecord;
  };

  return {
    billingPlan: client.billingPlan,
    billingSubscription: client.billingSubscription,
    billingUsageRecord: client.billingUsageRecord,
  };
}

export function areBillingDelegatesReady() {
  const delegates = getBillingDelegates();
  return Boolean(delegates.billingPlan && delegates.billingSubscription && delegates.billingUsageRecord);
}

export async function getBillingAdminSummary(): Promise<BillingAdminSummary> {
  const delegates = getBillingDelegates();

  if (!delegates.billingPlan || !delegates.billingSubscription) {
    return {
      planCount: 0,
      subscriptionCount: 0,
      statusCounts: {},
      ready: false,
      issue: "billing_delegate_missing",
      message:
        "Billing Prisma delegates are not available yet. Run Prisma generate and restart the app.",
    };
  }

  try {
    const [planCount, subscriptionCount, byStatus] = await Promise.all([
      delegates.billingPlan.count({ where: { status: "active" } }),
      delegates.billingSubscription.count(),
      delegates.billingSubscription.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    return {
      planCount,
      subscriptionCount,
      statusCounts: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      ready: true,
    };
  } catch (error) {
    console.error("Billing admin summary failed", error);
    return {
      planCount: 0,
      subscriptionCount: 0,
      statusCounts: {},
      ready: false,
      issue: isMissingBillingSchemaError(error) ? "billing_schema_missing" : "billing_query_failed",
      message: isMissingBillingSchemaError(error)
        ? "Billing database tables are not initialized yet. Run Prisma migrations, then seed billing plans."
        : "Billing data could not be loaded. Check the server logs for details.",
    };
  }
}
