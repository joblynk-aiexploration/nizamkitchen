import { prisma } from "@/lib/prisma";

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
