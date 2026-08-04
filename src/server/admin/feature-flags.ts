import type { getCurrentSession } from "@/lib/session";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { COOKIE_PRIVACY_CONSENT_FEATURE_FLAG, FEATURE_REGISTRY } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import {
  featureFlagCreateSchema,
  featureFlagUpdateSchema,
} from "@/lib/validation/admin";
import { recordAdminAuditLog } from "@/server/audit/audit-service";
import { createAdminNotification } from "@/server/notifications/notification-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

const REQUIRED_GLOBAL_FEATURE_FLAGS = [
  {
    key: COOKIE_PRIVACY_CONSENT_FEATURE_FLAG,
    name: "Cookie privacy consent and analytics",
    description:
      "Launch control for Secure Privacy CMP, Google Consent Mode, Google Analytics, and public tracking scripts. Disable during launch if analytics is not needed yet.",
    enabled: true,
  },
] as const;

export async function listAdminFeatureFlags(session: Session) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);

  if (session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin") {
    await ensureRequiredGlobalFeatureFlags();
  }

  return prisma.featureFlag.findMany({
    where: isCountryManager
      ? {
          OR: [
            { countryCode: { in: assignedCountries } },
            { countryCode: null, organizationId: null },
          ],
        }
      : {},
    include: {
      organization: true,
    },
    orderBy: [{ key: "asc" }, { countryCode: "asc" }],
  });
}

async function ensureRequiredGlobalFeatureFlags() {
  for (const flag of REQUIRED_GLOBAL_FEATURE_FLAGS) {
    const existing = await prisma.featureFlag.findFirst({
      where: { key: flag.key, organizationId: null, countryCode: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.featureFlag.update({
        where: { id: existing.id },
        data: {
          name: flag.name,
          description: flag.description,
        },
      });
      continue;
    }

    await prisma.featureFlag.create({
      data: {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        organizationId: null,
        countryCode: null,
      },
    });
  }
}

export async function createFeatureFlag(session: Session, input: unknown) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = featureFlagCreateSchema.parse(input);

  const data = normalizeFeatureFlagScope(parsed);
  const flag = await prisma.featureFlag.create({ data });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: data.organizationId ?? null,
    countryCode: data.countryCode ?? null,
    action: "feature_flag.updated",
    targetType: "feature_flag",
    targetId: flag.id,
    details: parsed,
  });
  await createAdminNotification({
    countryCode: data.countryCode ?? null,
    type: "feature_flag_changed",
    title: "Feature flag created",
    body: `${flag.key} was created by platform administration.`,
    actionUrl: "/admin/feature-flags",
    priority: "normal",
  });

  return flag;
}

export async function updateFeatureFlag(session: Session, id: string, input: unknown) {
  const existing = await prisma.featureFlag.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Feature flag not found.");
  }

  if (session.user.platformRole === "country_manager") {
    if (!existing.countryCode) {
      throw new Error("Country manager cannot update global flags.");
    }
    assertCountryAccess(session, existing.countryCode);
  } else {
    assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  }

  const parsed = featureFlagUpdateSchema.parse(input);
  const normalized = normalizeFeatureFlagScope({
    ...existing,
    ...parsed,
  });

  const flag = await prisma.featureFlag.update({
    where: { id },
    data: {
      key: normalized.key,
      name: normalized.name,
      description: normalized.description,
      enabled: normalized.enabled,
      countryCode: normalized.countryCode,
      organizationId: normalized.organizationId,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: normalized.organizationId ?? null,
    countryCode: normalized.countryCode ?? null,
    action: "feature_flag.updated",
    targetType: "feature_flag",
    targetId: id,
    details: parsed,
  });
  await createAdminNotification({
    countryCode: normalized.countryCode ?? null,
    type: "feature_flag_changed",
    title: "Feature flag changed",
    body: `${flag.key} is now ${flag.enabled ? "enabled" : "disabled"}.`,
    actionUrl: "/admin/feature-flags",
    priority: "normal",
  });

  return flag;
}

function normalizeFeatureFlagScope(input: {
  key: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  scopeType: "global" | "country" | "organization";
  countryCode?: string | null;
  organizationId?: string | null;
}) {
  if (input.scopeType === "global") {
    return {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled,
      countryCode: null,
      organizationId: null,
    };
  }

  if (input.scopeType === "country") {
    return {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled,
      countryCode: input.countryCode ?? null,
      organizationId: null,
    };
  }

  return {
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    enabled: input.enabled,
    countryCode: null,
    organizationId: input.organizationId ?? null,
  };
}

export type FeatureRegistryItem = {
  key: string;
  name: string;
  description: string;
  scope: "org" | "global";
  globalFlag: { id: string; enabled: boolean } | null;
  orgOverrides: Array<{ id: string; organizationId: string; organizationName: string; enabled: boolean }>;
  totalOrgs: number;
};

export async function listFeatureRegistry(session: Session): Promise<FeatureRegistryItem[]> {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin", "support_admin", "auditor"]);

  const [allFlags, totalOrgs] = await Promise.all([
    prisma.featureFlag.findMany({
      where: { countryCode: null },
      include: { organization: { select: { id: true, name: true } } },
    }),
    prisma.organization.count({ where: { status: "active" } }),
  ]);

  return FEATURE_REGISTRY.map((feature) => {
    const featureFlags = allFlags.filter((f) => f.key === feature.key);
    const globalFlag = featureFlags.find((f) => !f.organizationId) ?? null;
    const orgOverrides = featureFlags
      .filter((f) => f.organizationId && f.organization)
      .map((f) => ({
        id: f.id,
        organizationId: f.organizationId!,
        organizationName: f.organization!.name,
        enabled: f.enabled,
      }));

    return {
      key: feature.key,
      name: feature.name,
      description: feature.description,
      scope: feature.scope,
      globalFlag: globalFlag ? { id: globalFlag.id, enabled: globalFlag.enabled } : null,
      orgOverrides,
      totalOrgs,
    };
  });
}

export async function setGlobalFeatureFlag(session: Session, key: string, enabled: boolean) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  const feature = FEATURE_REGISTRY.find((f) => f.key === key);
  if (!feature) throw new Error(`Unknown feature key: ${key}`);

  const existing = await prisma.featureFlag.findFirst({
    where: { key, organizationId: null, countryCode: null },
  });

  let flag;
  if (existing) {
    flag = await prisma.featureFlag.update({
      where: { id: existing.id },
      data: { enabled, name: feature.name, description: feature.description },
    });
  } else {
    flag = await prisma.featureFlag.create({
      data: { key, name: feature.name, description: feature.description, enabled, organizationId: null, countryCode: null },
    });
  }

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: null,
    countryCode: null,
    action: "feature_flag.updated",
    targetType: "feature_flag",
    targetId: flag.id,
    details: { key, enabled, scope: "global" },
  });
  await createAdminNotification({
    countryCode: null,
    type: "feature_flag_changed",
    title: `Feature ${enabled ? "enabled" : "disabled"} globally`,
    body: `${feature.name} is now ${enabled ? "enabled" : "disabled"} for all organizations.`,
    actionUrl: "/admin/feature-flags",
    priority: "normal",
  });

  return flag;
}
