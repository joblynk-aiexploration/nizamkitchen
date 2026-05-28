import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { getBillingDelegates } from "@/server/billing/safe-billing";
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
