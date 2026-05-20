import { assertPlatformRole } from "@/lib/auth";
import { createAuditEvent } from "@/server/audit";
import { getBillingDelegates } from "@/server/billing/safe-billing";
import { Prisma, type BillingInterval, type BillingPlanStatus } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function listBillingPlans(statusFilter?: BillingPlanStatus) {
  const { billingPlan } = getBillingDelegates();
  if (!billingPlan) {
    console.error("BillingPlan Prisma delegate is unavailable. Run prisma generate and restart.");
    return [];
  }

  try {
    return await billingPlan.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: [{ status: "asc" }, { priceAmount: "asc" }],
    });
  } catch (error) {
    console.error("Unable to list billing plans", error);
    return [];
  }
}

export async function getBillingPlanBySlug(slug: string) {
  const { billingPlan } = getBillingDelegates();
  if (!billingPlan) {
    return null;
  }

  return billingPlan.findUnique({ where: { slug } });
}

export async function getBillingPlanById(id: string) {
  const { billingPlan } = getBillingDelegates();
  if (!billingPlan) {
    return null;
  }

  return billingPlan.findUnique({ where: { id } });
}

async function requireBillingPlanDelegate() {
  const { billingPlan } = getBillingDelegates();
  if (!billingPlan) {
    throw new Error("Billing is not initialized. Run Prisma generate and migrations first.");
  }
  return billingPlan;
}

type PlanInput = {
  name: string;
  slug: string;
  description?: string | null;
  priceAmount: number;
  currencyCode?: string;
  billingInterval?: BillingInterval;
  status?: BillingPlanStatus;
  limitsJson?: Record<string, unknown>;
  featuresJson?: unknown[];
};

export async function createBillingPlan(session: Session, input: PlanInput) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const billingPlan = await requireBillingPlanDelegate();
  const plan = await billingPlan.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      priceAmount: input.priceAmount,
      currencyCode: input.currencyCode ?? "USD",
      billingInterval: input.billingInterval ?? "monthly",
      status: input.status ?? "draft",
      limitsJson: (input.limitsJson ?? {}) as Prisma.InputJsonValue,
      featuresJson: (input.featuresJson ?? []) as Prisma.InputJsonValue,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing_plan.created",
    targetType: "billing_plan",
    targetId: plan.id,
    details: { slug: plan.slug, name: plan.name },
  });
  return plan;
}

export async function updateBillingPlan(
  session: Session,
  id: string,
  input: Partial<PlanInput & { status: BillingPlanStatus }>,
) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const billingPlan = await requireBillingPlanDelegate();
  const plan = await billingPlan.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.priceAmount !== undefined && { priceAmount: input.priceAmount }),
      ...(input.currencyCode !== undefined && { currencyCode: input.currencyCode }),
      ...(input.billingInterval !== undefined && { billingInterval: input.billingInterval }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.limitsJson !== undefined && { limitsJson: input.limitsJson as Prisma.InputJsonValue }),
      ...(input.featuresJson !== undefined && { featuresJson: input.featuresJson as Prisma.InputJsonValue }),
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing_plan.updated",
    targetType: "billing_plan",
    targetId: plan.id,
    details: { slug: plan.slug, changes: Object.keys(input) },
  });
  return plan;
}
