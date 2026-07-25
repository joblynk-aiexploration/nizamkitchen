import { assertPlatformRole } from "@/lib/auth";
import { shouldSkipBuildTimeDatabase } from "@/lib/build-phase";
import { createAuditEvent } from "@/server/audit";
import { getBillingDelegates } from "@/server/billing/safe-billing";
import { Prisma, type BillingInterval, type BillingPlanAudience, type BillingPlanStatus } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function listBillingPlans(statusFilter?: BillingPlanStatus, audienceFilter?: BillingPlanAudience) {
  if (shouldSkipBuildTimeDatabase()) return [];

  const { billingPlan } = getBillingDelegates();
  if (!billingPlan) {
    console.error("BillingPlan Prisma delegate is unavailable. Run prisma generate and restart.");
    return [];
  }

  try {
    const where = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(audienceFilter ? { planAudience: audienceFilter } : {}),
    };

    return await billingPlan.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [{ planAudience: "asc" }, { status: "asc" }, { isPopular: "desc" }, { priceAmount: "asc" }],
    });
  } catch (error) {
    console.error("Unable to list billing plans", error);
    return [];
  }
}

export async function listActiveBillingPlans(audienceFilter?: BillingPlanAudience) {
  return listBillingPlans("active", audienceFilter);
}

export async function getBillingPlanBySlug(slug: string) {
  const { billingPlan } = getBillingDelegates();
  if (!billingPlan) {
    return null;
  }

  return billingPlan.findUnique({ where: { slug } });
}

export async function getActiveBillingPlanBySlug(slug: string) {
  const plan = await getBillingPlanBySlug(slug);
  return plan?.status === "active" ? plan : null;
}

export async function getBillingPlanById(id: string) {
  const { billingPlan } = getBillingDelegates();
  if (!billingPlan) {
    return null;
  }

  return billingPlan.findUnique({ where: { id } });
}

export async function getActiveBillingPlanById(id: string) {
  const plan = await getBillingPlanById(id);
  return plan?.status === "active" ? plan : null;
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
  planAudience: BillingPlanAudience;
  isPopular?: boolean;
  stripePriceId?: string | null;
  limitsJson?: Record<string, unknown>;
  featuresJson?: unknown[];
};

export async function createBillingPlan(session: Session, input: PlanInput) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  validateStripePriceId(input.stripePriceId);
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
      planAudience: input.planAudience,
      isPopular: input.isPopular ?? false,
      stripePriceId: input.stripePriceId ?? null,
      limitsJson: (input.limitsJson ?? {}) as Prisma.InputJsonValue,
      featuresJson: (input.featuresJson ?? []) as Prisma.InputJsonValue,
    },
  });
  if (plan.isPopular) {
    await clearPopularPlanForAudience(plan.planAudience, plan.id);
  }
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
  validateStripePriceId(input.stripePriceId);
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
      ...(input.planAudience !== undefined && { planAudience: input.planAudience }),
      ...(input.isPopular !== undefined && { isPopular: input.isPopular }),
      ...(input.stripePriceId !== undefined && { stripePriceId: input.stripePriceId }),
      ...(input.limitsJson !== undefined && { limitsJson: input.limitsJson as Prisma.InputJsonValue }),
      ...(input.featuresJson !== undefined && { featuresJson: input.featuresJson as Prisma.InputJsonValue }),
    },
  });
  if (plan.isPopular) {
    await clearPopularPlanForAudience(plan.planAudience, plan.id);
  }
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing_plan.updated",
    targetType: "billing_plan",
    targetId: plan.id,
    details: { slug: plan.slug, changes: Object.keys(input) },
  });
  return plan;
}

async function clearPopularPlanForAudience(planAudience: BillingPlanAudience, exceptPlanId?: string) {
  const billingPlan = await requireBillingPlanDelegate();
  await billingPlan.updateMany({
    where: {
      planAudience,
      isPopular: true,
      ...(exceptPlanId ? { id: { not: exceptPlanId } } : {}),
    },
    data: { isPopular: false },
  });
}

function validateStripePriceId(stripePriceId?: string | null) {
  if (stripePriceId && !stripePriceId.startsWith("price_")) {
    throw new Error("Stripe Price ID must start with price_ or be left blank.");
  }
}
