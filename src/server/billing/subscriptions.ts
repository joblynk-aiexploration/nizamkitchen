import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { getBillingDelegates } from "@/server/billing/safe-billing";
import { clearAllLimitOverrides } from "@/server/billing/limit-overrides";
import type { BillingProvider, BillingSubscriptionStatus } from "@prisma/client";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function getActiveSubscription(organizationId: string) {
  const { billingSubscription } = getBillingDelegates();
  if (!billingSubscription) {
    console.error("BillingSubscription Prisma delegate is unavailable. Run prisma generate and restart.");
    return null;
  }

  return billingSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ["active", "trialing", "free"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSubscriptionForOrg(organizationId: string) {
  const { billingSubscription } = getBillingDelegates();
  if (!billingSubscription) {
    return null;
  }

  return billingSubscription.findFirst({
    where: { organizationId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllSubscriptions(session: Session) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);
  const { billingSubscription } = getBillingDelegates();
  if (!billingSubscription) {
    console.error("BillingSubscription Prisma delegate is unavailable. Run prisma generate and restart.");
    return [];
  }

  try {
    return await billingSubscription.findMany({
      include: { plan: true, organization: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Unable to list billing subscriptions", error);
    return [];
  }
}

export async function assignSubscription(
  session: Session,
  organizationId: string,
  planId: string,
  options?: {
    status?: BillingSubscriptionStatus;
    provider?: BillingProvider;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    trialEndsAt?: Date;
  },
) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  const plan = await prisma.billingPlan.findUniqueOrThrow({ where: { id: planId } });

  const subscription = await prisma.billingSubscription.create({
    data: {
      organizationId,
      planId,
      status: options?.status ?? "free",
      provider: options?.provider ?? "manual",
      currentPeriodStart: options?.currentPeriodStart ?? null,
      currentPeriodEnd: options?.currentPeriodEnd ?? null,
      trialEndsAt: options?.trialEndsAt ?? null,
    },
    include: { plan: true },
  });

  // Clear any per-org limit overrides when a plan is assigned so they
  // don't silently carry forward across plan generations.
  await clearAllLimitOverrides(organizationId);

  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing_subscription.created",
    targetType: "billing_subscription",
    targetId: subscription.id,
    organizationId,
    details: { planSlug: plan.slug, status: subscription.status },
  });

  return subscription;
}

export async function updateSubscriptionStatus(
  session: Session,
  subscriptionId: string,
  status: BillingSubscriptionStatus,
) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  const subscription = await prisma.billingSubscription.update({
    where: { id: subscriptionId },
    data: { status },
    include: { plan: true },
  });

  const action =
    status === "cancelled"
      ? "billing_subscription.cancelled"
      : "billing_subscription.updated";

  await createAuditEvent({
    actorUserId: session.user.id,
    action,
    targetType: "billing_subscription",
    targetId: subscriptionId,
    organizationId: subscription.organizationId,
    details: { newStatus: status, planSlug: subscription.plan.slug },
  });

  return subscription;
}

export async function changeSubscriptionPlan(
  session: Session,
  subscriptionId: string,
  planId: string,
) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  const [existing, nextPlan] = await Promise.all([
    prisma.billingSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    }),
    prisma.billingPlan.findUnique({ where: { id: planId } }),
  ]);

  if (!existing) throw new Error("Subscription not found.");
  if (!nextPlan) throw new Error("Pricing plan not found.");
  if (nextPlan.status !== "active") throw new Error("Only active pricing plans can be assigned.");

  const nextStatus: BillingSubscriptionStatus =
    Number(nextPlan.priceAmount) === 0
      ? "free"
      : existing.status === "cancelled" || existing.status === "free"
        ? "active"
        : existing.status;

  const subscription = await prisma.billingSubscription.update({
    where: { id: subscriptionId },
    data: {
      planId: nextPlan.id,
      status: nextStatus,
      cancelAtPeriodEnd: false,
    },
    include: { plan: true },
  });

  // Clear per-org limit overrides on plan change so old overrides don't
  // silently apply to a plan the admin never intended them for.
  await clearAllLimitOverrides(subscription.organizationId);

  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing_subscription.plan_changed",
    targetType: "billing_subscription",
    targetId: subscriptionId,
    organizationId: subscription.organizationId,
    details: {
      previousPlanSlug: existing.plan.slug,
      newPlanSlug: nextPlan.slug,
      previousStatus: existing.status,
      newStatus: subscription.status,
      provider: subscription.provider,
      providerSubscriptionId: subscription.providerSubscriptionId,
    },
  });

  return subscription;
}
