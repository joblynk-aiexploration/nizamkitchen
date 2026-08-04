import { prisma } from "@/lib/prisma";

export const COOKIE_PRIVACY_CONSENT_FEATURE_FLAG = "cookie_privacy_consent";

export type FeatureDefinition = {
  key: string;
  name: string;
  description: string;
  scope: "org" | "global";
};

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  {
    key: "grocery_engine",
    name: "Grocery Engine",
    description: "Smart grocery list generation from recipes, with unit conversions and partner integrations.",
    scope: "org",
  },
  {
    key: "meal_planner",
    name: "Meal Planner",
    description: "Weekly meal planning with recipe scheduling and nutritional tracking.",
    scope: "org",
  },
  {
    key: "home_chefs",
    name: "Home Chefs",
    description: "Home chef marketplace — browse, order, and review independent home chefs.",
    scope: "org",
  },
  {
    key: "home_catering",
    name: "Home Catering",
    description: "Home catering marketplace — book catering services for events.",
    scope: "org",
  },
  {
    key: "restaurant_profiles",
    name: "Restaurant Profiles",
    description: "Public restaurant discovery, menus, and profile pages.",
    scope: "org",
  },
  {
    key: "restaurant_fallback",
    name: "Restaurant Ordering",
    description: "Order from restaurants as a fallback when home chefs are unavailable.",
    scope: "org",
  },
  {
    key: "menus",
    name: "Menus",
    description: "Digital menu management and public menu display for food businesses.",
    scope: "org",
  },
  {
    key: "family_profiles",
    name: "Family Profiles",
    description: "Household member profiles with dietary preferences and portion tracking.",
    scope: "org",
  },
  {
    key: "grocery_partners",
    name: "Grocery Partners",
    description: "Integration with grocery delivery partners for automated ingredient purchasing.",
    scope: "org",
  },
  {
    key: "seller_verification",
    name: "Seller Verification",
    description: "Identity and certification verification for home chefs and caterers.",
    scope: "org",
  },
  {
    key: "youtube_references",
    name: "YouTube References",
    description: "Attach YouTube video references to recipes for visual cooking guidance.",
    scope: "org",
  },
  {
    key: COOKIE_PRIVACY_CONSENT_FEATURE_FLAG,
    name: "Cookie Privacy Consent",
    description: "SecurePrivacy CMP, Google Consent Mode, Google Analytics, and public tracking scripts.",
    scope: "global",
  },
];

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
