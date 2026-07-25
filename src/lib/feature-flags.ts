import { prisma } from "@/lib/prisma";

export const COOKIE_PRIVACY_CONSENT_FEATURE_FLAG = "cookie_privacy_consent";

export async function isFeatureEnabled(key: string, organizationId: string | null): Promise<boolean> {
  const flags = await prisma.featureFlag.findMany({
    where: {
      key,
      OR: [
        { organizationId },
        { organizationId: null, countryCode: null },
      ],
    },
    orderBy: [{ organizationId: "desc" }],
  });
  if (flags.length === 0) return false;
  // Org-specific flag takes precedence
  const orgFlag = flags.find((f) => f.organizationId === organizationId);
  if (orgFlag) return orgFlag.enabled;
  return flags[0].enabled;
}

export async function isGlobalFeatureEnabled(key: string, defaultEnabled = false): Promise<boolean> {
  try {
    const flag = await prisma.featureFlag.findFirst({
      where: { key, organizationId: null, countryCode: null },
      select: { enabled: true },
    });
    return flag?.enabled ?? defaultEnabled;
  } catch {
    return defaultEnabled;
  }
}
