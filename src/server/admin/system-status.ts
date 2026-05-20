import type { PlatformRole } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getObservabilitySnapshot } from "@/server/observability";
import { getSystemAlertMetrics } from "@/server/observability/system-alerts";

const SYSTEM_STATUS_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export type SystemStatusSession = {
  user: {
    id?: string;
    platformRole: PlatformRole | null;
  };
};

export async function getAdminSystemStatus(session: SystemStatusSession) {
  assertPlatformRole(session.user.platformRole, SYSTEM_STATUS_ROLES);

  const [
    database,
    featureFlagsCount,
    usersCount,
    organizationsCount,
    latestAuditLogs,
    integrations,
    alerts,
    failures,
  ] = await Promise.all([
    getDatabaseStatus(),
    prisma.featureFlag.count(),
    prisma.user.count(),
    prisma.organization.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        targetType: true,
        countryCode: true,
        createdAt: true,
      },
    }),
    getIntegrationStatuses(),
    getSystemAlertMetrics(session),
    getRecentFailures(),
  ]);

  return {
    app: {
      name: "NizamKitchen",
      version: process.env.npm_package_version ?? "0.1.0",
      build: process.env.NEXT_PUBLIC_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || "local-build",
      environment: env.DEPLOYMENT_ENVIRONMENT,
    },
    database,
    counts: {
      featureFlags: featureFlagsCount,
      users: usersCount,
      organizations: organizationsCount,
    },
    observability: getObservabilitySnapshot(),
    integrations,
    alerts,
    failures,
    latestAuditLogs,
    docs: {
      backups: "/docs/backup-and-restore.md",
      operations: "/docs/operations.md",
      incidentResponse: "/docs/incident-response.md",
    },
  };
}

export async function getIntegrationStatuses() {
  const [storageActive, storageError, stripeGateway, paypalGateway, failedPaymentWebhooks, failedPayments, kycProviders] = await Promise.all([
    prisma.storageConfiguration.count({ where: { status: "active" } }),
    prisma.storageConfiguration.count({ where: { OR: [{ status: "error" }, { lastTestStatus: "failed" }] } }),
    prisma.paymentGateway.count({ where: { provider: "stripe", status: "active" } }),
    prisma.paymentGateway.count({ where: { provider: "paypal", status: "active" } }),
    prisma.paymentWebhookEvent.count({ where: { status: "failed" } }),
    prisma.paymentOrder.count({ where: { status: "failed" } }),
    prisma.kycProviderConfiguration.count({ where: { status: "active" } }),
  ]);

  return {
    mapTiler: {
      configured: Boolean(env.MAPTILER_API_KEY || env.NEXT_PUBLIC_MAPTILER_API_KEY),
      enabled: Boolean(env.MAPTILER_RESTAURANT_DISCOVERY_ENABLED),
    },
    youtube: {
      configured: Boolean(env.YOUTUBE_DATA_API_KEY),
      enabled: Boolean(env.YOUTUBE_DISCOVERY_ENABLED),
    },
    smtp: {
      configured: Boolean(env.SMTP_HOST && env.EMAIL_FROM && env.SMTP_HOST !== "localhost"),
    },
    stripe: {
      configured: stripeGateway > 0 || Boolean(process.env.STRIPE_SECRET_KEY),
      activeGateways: stripeGateway,
    },
    paypal: {
      configured: paypalGateway > 0 || Boolean(process.env.PAYPAL_CLIENT_ID),
      activeGateways: paypalGateway,
    },
    storage: {
      configured: storageActive > 0,
      activeConfigurations: storageActive,
      failingConfigurations: storageError,
    },
    kyc: {
      configured: kycProviders > 0,
      activeProviders: kycProviders,
    },
    errorTracking: {
      configured: Boolean(env.ERROR_TRACKING_ENABLED && (env.ERROR_TRACKING_DSN || env.SENTRY_DSN)),
      enabled: env.ERROR_TRACKING_ENABLED,
    },
    paymentHealth: {
      failedWebhooks: failedPaymentWebhooks,
      failedPayments,
    },
  };
}

async function getRecentFailures() {
  const [webhookFailures, paymentFailures, storageFailures] = await Promise.all([
    prisma.paymentWebhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, provider: true, eventType: true, errorMessage: true, createdAt: true },
    }),
    prisma.paymentOrder.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, provider: true, module: true, countryCode: true, failureCode: true, failureMessage: true, createdAt: true },
    }),
    prisma.storageConfiguration.findMany({
      where: { OR: [{ status: "error" }, { lastTestStatus: "failed" }] },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, provider: true, displayName: true, lastTestStatus: true, lastTestMessage: true, updatedAt: true },
    }),
  ]);

  return {
    webhookFailures,
    paymentFailures,
    storageFailures,
  };
}

async function getDatabaseStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations"`;
    return {
      reachable: true,
      migrationsReachable: true,
    };
  } catch {
    return {
      reachable: false,
      migrationsReachable: false,
    };
  }
}
