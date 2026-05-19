import type { PlatformRole } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const SYSTEM_STATUS_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export type SystemStatusSession = {
  user: {
    platformRole: PlatformRole | null;
  };
};

export async function getAdminSystemStatus(session: SystemStatusSession) {
  assertPlatformRole(session.user.platformRole, SYSTEM_STATUS_ROLES);

  const [database, featureFlagsCount, usersCount, organizationsCount, latestAuditLogs] = await Promise.all([
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
    integrations: {
      mapTiler: Boolean(env.MAPTILER_API_KEY || env.NEXT_PUBLIC_MAPTILER_API_KEY),
      youtube: Boolean(env.YOUTUBE_DATA_API_KEY),
      smtp: Boolean(env.SMTP_HOST && env.EMAIL_FROM && env.SMTP_HOST !== "localhost"),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    },
    latestAuditLogs,
    docs: {
      backups: "/docs/backup-and-restore.md",
      operations: "/docs/operations.md",
      incidentResponse: "/docs/incident-response.md",
    },
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
