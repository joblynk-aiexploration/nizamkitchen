import { HomeChefPrivacyPolicyStatus, HomeChefRevealTrigger, type PlatformRole } from "@prisma/client";
import { z } from "zod";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

const HOME_CHEF_PRIVACY_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];

type AdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
};

export const homeChefPrivacyPolicySchema = z.object({
  countryCode: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim().toUpperCase()), z.string().max(2).nullable().optional()),
  region: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(80).nullable().optional()),
  city: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(120).nullable().optional()),
  requestType: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(["recipe", "meal_plan", "occasion", "weekly_cooking", "daily_cooking", "custom"]).nullable().optional()),
  revealExactAddressTrigger: z.nativeEnum(HomeChefRevealTrigger).default("booking_locked"),
  revealCustomerNameTrigger: z.nativeEnum(HomeChefRevealTrigger).default("booking_locked"),
  allowPreAcceptanceMessaging: z.boolean().default(true),
  allowFirstNameBeforeAcceptance: z.boolean().default(false),
  allowPhoneProxyAfterLock: z.boolean().default(true),
  allowRealPhoneReveal: z.boolean().default(false),
  allowEmailReveal: z.boolean().default(false),
  revokeAccessOnCancellation: z.boolean().default(true),
  revokeAccessAfterCompletionDays: z.coerce.number().int().min(0).nullable().optional(),
  emergencyContactWindowHours: z.coerce.number().int().min(1).max(168).default(24),
  status: z.nativeEnum(HomeChefPrivacyPolicyStatus).default("active"),
});

export async function listHomeChefPrivacyPolicies(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, HOME_CHEF_PRIVACY_ADMIN_ROLES);
  return prisma.homeChefPrivacyPolicy.findMany({
    orderBy: [{ status: "asc" }, { countryCode: "asc" }, { region: "asc" }, { city: "asc" }, { updatedAt: "desc" }],
  });
}

export async function upsertHomeChefPrivacyPolicy(params: {
  session: AdminSession;
  policyId?: string | null;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, HOME_CHEF_PRIVACY_ADMIN_ROLES);
  const parsed = homeChefPrivacyPolicySchema.parse(params.input);
  const existing = params.policyId
    ? await prisma.homeChefPrivacyPolicy.findUnique({ where: { id: params.policyId } })
    : await prisma.homeChefPrivacyPolicy.findFirst({
        where: {
          countryCode: parsed.countryCode ?? null,
          region: parsed.region ?? null,
          city: parsed.city ?? null,
          requestType: parsed.requestType ?? null,
        },
      });

  const policy = existing
    ? await prisma.homeChefPrivacyPolicy.update({
        where: { id: existing.id },
        data: { ...parsed, updatedById: params.session.user.id },
      })
    : await prisma.homeChefPrivacyPolicy.create({
        data: { ...parsed, createdById: params.session.user.id },
      });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    countryCode: policy.countryCode,
    action: existing ? "home_chef_privacy_policy.updated" : "home_chef_privacy_policy.created",
    targetType: "home_chef_privacy_policy",
    targetId: policy.id,
    details: {
      countryCode: policy.countryCode,
      region: policy.region,
      city: policy.city,
      requestType: policy.requestType,
      revealExactAddressTrigger: policy.revealExactAddressTrigger,
      revealCustomerNameTrigger: policy.revealCustomerNameTrigger,
    },
  });

  return policy;
}
