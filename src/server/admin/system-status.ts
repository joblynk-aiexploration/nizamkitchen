import type { PlatformRole } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getObservabilitySnapshot } from "@/server/observability";
import { getSystemAlertMetrics } from "@/server/observability/system-alerts";

const SYSTEM_STATUS_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin", "auditor"];

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
  const [
    storageActive,
    storageError,
    stripeGateway,
    paypalGateway,
    failedPaymentWebhooks,
    failedPayments,
    kycProviders,
    vaultIntegrations,
  ] = await Promise.all([
    prisma.storageConfiguration.count({ where: { status: "active" } }),
    prisma.storageConfiguration.count({ where: { OR: [{ status: "error" }, { lastTestStatus: "failed" }] } }),
    prisma.paymentGateway.count({ where: { provider: "stripe", status: "active" } }),
    prisma.paymentGateway.count({ where: { provider: "paypal", status: "active" } }),
    prisma.paymentWebhookEvent.count({ where: { status: "failed" } }),
    prisma.paymentOrder.count({ where: { status: "failed" } }),
    prisma.kycProviderConfiguration.count({ where: { status: "active" } }),
    prisma.platformIntegration.findMany({
      where: { status: "active" },
      select: { provider: true },
    }),
  ]);

  const vaultProviderCount = vaultIntegrations.reduce<Record<string, number>>((accumulator, integration) => {
    accumulator[integration.provider] = (accumulator[integration.provider] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    googleMaps: {
      configured:
        (vaultProviderCount.google_maps ?? 0) > 0 ||
        (vaultProviderCount.google_places ?? 0) > 0 ||
        (vaultProviderCount.google_geocoding ?? 0) > 0 ||
        Boolean(
          process.env.GOOGLE_MAPS_BROWSER_API_KEY ||
            process.env.GOOGLE_MAPS_SERVER_API_KEY ||
            process.env.GOOGLE_PLACES_SERVER_API_KEY ||
            process.env.GOOGLE_GEOCODING_API_KEY,
        ),
      enabled:
        (vaultProviderCount.google_maps ?? 0) > 0 ||
        (vaultProviderCount.google_places ?? 0) > 0 ||
        Boolean(process.env.GOOGLE_MAPS_BROWSER_API_KEY || process.env.GOOGLE_PLACES_SERVER_API_KEY),
      mapsJavascriptConfigured:
        (vaultProviderCount.google_maps ?? 0) > 0 || Boolean(process.env.GOOGLE_MAPS_BROWSER_API_KEY),
      placesConfigured:
        (vaultProviderCount.google_places ?? 0) > 0 || Boolean(process.env.GOOGLE_PLACES_SERVER_API_KEY),
      geocodingConfigured:
        (vaultProviderCount.google_geocoding ?? 0) > 0 || Boolean(process.env.GOOGLE_GEOCODING_API_KEY),
    },
    youtube: {
      configured: (vaultProviderCount.youtube_data ?? 0) > 0 || Boolean(env.YOUTUBE_DATA_API_KEY),
      enabled: Boolean(env.YOUTUBE_DISCOVERY_ENABLED),
    },
    smtp: {
      configured: (vaultProviderCount.smtp ?? 0) > 0 || Boolean(env.SMTP_HOST && env.EMAIL_FROM && env.SMTP_HOST !== "localhost"),
    },
    stripe: {
      configured: stripeGateway > 0 || (vaultProviderCount.stripe ?? 0) > 0 || Boolean(process.env.STRIPE_SECRET_KEY),
      activeGateways: stripeGateway + (vaultProviderCount.stripe ?? 0),
    },
    paypal: {
      configured: paypalGateway > 0 || (vaultProviderCount.paypal ?? 0) > 0 || Boolean(process.env.PAYPAL_CLIENT_ID),
      activeGateways: paypalGateway + (vaultProviderCount.paypal ?? 0),
    },
    storage: {
      configured: storageActive > 0 || (vaultProviderCount.aws_s3 ?? 0) > 0,
      activeConfigurations: storageActive + (vaultProviderCount.aws_s3 ?? 0),
      failingConfigurations: storageError,
    },
    kyc: {
      configured: kycProviders > 0 || (vaultProviderCount.kyc_provider ?? 0) > 0 || (vaultProviderCount.background_check_provider ?? 0) > 0,
      activeProviders: kycProviders + (vaultProviderCount.kyc_provider ?? 0) + (vaultProviderCount.background_check_provider ?? 0),
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
