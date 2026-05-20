import { PaymentProvider, SellerType, type PlatformRole, type Prisma } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sellerVerificationOverrideRevokeSchema,
  sellerVerificationOverrideSchema,
  sellerVerificationPolicySchema,
} from "@/lib/validation/seller-verification-gates";
import { createAuditEvent } from "@/server/audit";

type GateCapability = "public_profile" | "menu_publishing" | "order_acceptance" | "payouts" | "home_chef_assignment";

type AdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
};

const SELLER_GATE_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

const verificationProfileArgs = {
  include: {
    items: true,
    foodSafetyCertificates: true,
    permits: true,
    kitchenReviews: true,
    backgroundChecks: true,
    identityVerifications: true,
    organization: { select: { id: true, countryCode: true, organizationType: true, status: true } },
  },
} satisfies Prisma.SellerVerificationProfileDefaultArgs;

type VerificationProfile = Prisma.SellerVerificationProfileGetPayload<typeof verificationProfileArgs>;

export type SellerGateResult = {
  allowed: boolean;
  sellerType: SellerType;
  policyId: string | null;
  policyName: string | null;
  missingRequirements: string[];
  blockedCapabilities: GateCapability[];
  overrideActive: boolean;
};

export async function resolveSellerVerificationPolicy(params: {
  sellerType: SellerType;
  countryCode?: string | null;
  region?: string | null;
}) {
  const policies = await prisma.sellerVerificationPolicy.findMany({
    where: {
      sellerType: params.sellerType,
      status: "active",
      OR: [
        { countryCode: params.countryCode ?? undefined, region: params.region ?? undefined },
        { countryCode: params.countryCode ?? undefined, region: null },
        { countryCode: null, region: null },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  return policies.sort((a, b) => policyScore(b, params) - policyScore(a, params))[0] ?? null;
}

export async function getSellerVerificationGate(params: {
  organizationId: string;
  sellerType: SellerType;
  countryCode?: string | null;
  region?: string | null;
  capability: GateCapability;
}): Promise<SellerGateResult> {
  const [policy, profile, payoutAccount] = await Promise.all([
    resolveSellerVerificationPolicy(params),
    prisma.sellerVerificationProfile.findUnique({ where: { organizationId: params.organizationId }, ...verificationProfileArgs }),
    prisma.sellerPayoutAccount.findFirst({
      where: { organizationId: params.organizationId, provider: { in: [PaymentProvider.stripe, PaymentProvider.paypal] } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
  ]);

  if (!policy) {
    return {
      allowed: true,
      sellerType: params.sellerType,
      policyId: null,
      policyName: null,
      missingRequirements: [],
      blockedCapabilities: [],
      overrideActive: false,
    };
  }

  const overrideActive = await hasActiveOverride(params.organizationId, policy.id);
  const blockedCapabilities = blockedCapabilitiesForPolicy(policy);
  const profileStatus = profile?.status ?? "not_started";
  const forceBlocked = profileStatus === "rejected" || profileStatus === "suspended";
  const capabilityBlocked = blockedCapabilities.includes(params.capability);
  const missingRequirements = forceBlocked
    ? [`Seller verification is ${profileStatus}.`]
    : getMissingRequirements(policy, profile, payoutAccount);
  const allowedBeforeVerification = isCapabilityAllowedBeforeVerification(policy, params.capability);

  const allowed =
    !forceBlocked &&
    (overrideActive || allowedBeforeVerification || !capabilityBlocked || missingRequirements.length === 0);

  return {
    allowed,
    sellerType: params.sellerType,
    policyId: policy.id,
    policyName: policy.policyName,
    missingRequirements,
    blockedCapabilities,
    overrideActive,
  };
}

export async function assertSellerGate(params: {
  organizationId: string;
  sellerType: SellerType;
  countryCode?: string | null;
  region?: string | null;
  capability: GateCapability;
  message: string;
}) {
  const result = await getSellerVerificationGate(params);
  if (!result.allowed) {
    const details = result.missingRequirements.length ? ` ${result.missingRequirements.join(" ")}` : "";
    throw new Error(`${params.message}${details}`);
  }
  return result;
}

export async function getSellerDashboardVerificationSummary(params: {
  organizationId: string;
  sellerType: SellerType;
  countryCode?: string | null;
  region?: string | null;
}) {
  const capabilities: GateCapability[] = ["public_profile", "menu_publishing", "order_acceptance", "payouts"];
  const results = await Promise.all(capabilities.map((capability) => getSellerVerificationGate({ ...params, capability })));
  const missingRequirements = [...new Set(results.flatMap((result) => result.missingRequirements))];
  const blockedCapabilities = [...new Set(results.filter((result) => !result.allowed).map((result) => result.blockedCapabilities).flat())];
  return { missingRequirements, blockedCapabilities, policyName: results[0]?.policyName ?? null, overrideActive: results.some((result) => result.overrideActive) };
}

export async function listSellerVerificationPolicies() {
  return prisma.sellerVerificationPolicy.findMany({
    orderBy: [{ sellerType: "asc" }, { countryCode: "asc" }, { region: "asc" }, { updatedAt: "desc" }],
  });
}

export async function listSellerVerificationOverrides(organizationId: string) {
  return prisma.sellerVerificationOverride.findMany({
    where: { organizationId },
    include: { policy: { select: { policyName: true } }, grantedBy: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function saveSellerVerificationPolicy(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, SELLER_GATE_ADMIN_ROLES);
  const parsed = sellerVerificationPolicySchema.parse(input);
  const data = {
    countryCode: parsed.countryCode || null,
    region: parsed.region || null,
    sellerType: parsed.sellerType,
    policyName: parsed.policyName,
    status: parsed.status,
    allowPublicProfileBeforeVerification: parsed.allowPublicProfileBeforeVerification,
    allowMenuPublishingBeforeVerification: parsed.allowMenuPublishingBeforeVerification,
    allowOrderAcceptanceBeforeVerification: parsed.allowOrderAcceptanceBeforeVerification,
    allowPayoutsBeforeVerification: parsed.allowPayoutsBeforeVerification,
    requireIdentityVerification: parsed.requireIdentityVerification,
    requireFoodHandlerCertificate: parsed.requireFoodHandlerCertificate,
    requireLocalPermit: parsed.requireLocalPermit,
    requireKitchenReview: parsed.requireKitchenReview,
    requireBackgroundCheck: parsed.requireBackgroundCheck,
    requirePayoutOnboarding: parsed.requirePayoutOnboarding,
    requireAdminApproval: parsed.requireAdminApproval,
  };
  const policy = parsed.policyId
    ? await prisma.sellerVerificationPolicy.update({ where: { id: parsed.policyId }, data })
    : await prisma.sellerVerificationPolicy.create({ data });

  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: null,
    countryCode: policy.countryCode,
    action: parsed.policyId ? "seller_verification_policy.updated" : "seller_verification_policy.created",
    targetType: "seller_verification_policy",
    targetId: policy.id,
    details: { sellerType: policy.sellerType, policyName: policy.policyName },
  });
  return policy;
}

export async function grantSellerVerificationOverride(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, SELLER_GATE_ADMIN_ROLES);
  const parsed = sellerVerificationOverrideSchema.parse(input);
  const organization = await prisma.organization.findUnique({ where: { id: parsed.organizationId }, select: { id: true, countryCode: true } });
  if (!organization) throw new Error("Seller organization not found.");
  const override = await prisma.sellerVerificationOverride.create({
    data: {
      organizationId: parsed.organizationId,
      policyId: parsed.policyId || null,
      grantedById: session.user.id,
      reason: parsed.reason,
      expiresAt: parsed.expiresAt ?? null,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: parsed.organizationId,
    countryCode: organization.countryCode,
    action: "seller_verification_override.granted",
    targetType: "seller_verification_override",
    targetId: override.id,
    details: { policyId: override.policyId, expiresAt: override.expiresAt, reason: override.reason },
  });
  return override;
}

export async function revokeSellerVerificationOverride(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, SELLER_GATE_ADMIN_ROLES);
  const parsed = sellerVerificationOverrideRevokeSchema.parse(input);
  const existing = await prisma.sellerVerificationOverride.findUnique({
    where: { id: parsed.overrideId },
    include: { organization: { select: { countryCode: true } } },
  });
  if (!existing) throw new Error("Verification override not found.");
  const override = await prisma.sellerVerificationOverride.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: existing.organizationId,
    countryCode: existing.organization.countryCode,
    action: "seller_verification_override.revoked",
    targetType: "seller_verification_override",
    targetId: override.id,
    details: { policyId: override.policyId },
  });
  return override;
}

async function hasActiveOverride(organizationId: string, policyId: string) {
  const now = new Date();
  const override = await prisma.sellerVerificationOverride.findFirst({
    where: {
      organizationId,
      revokedAt: null,
      OR: [{ policyId }, { policyId: null }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: { id: true },
  });
  return Boolean(override);
}

function getMissingRequirements(
  policy: NonNullable<Awaited<ReturnType<typeof resolveSellerVerificationPolicy>>>,
  profile: VerificationProfile | null,
  payoutAccount: { status: string; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean } | null,
) {
  const missing: string[] = [];
  if (!profile) {
    missing.push("Create and submit a seller verification profile.");
    return missing;
  }
  if (policy.requireAdminApproval && profile.status !== "verified") missing.push("Admin approval is required.");
  if (policy.requireIdentityVerification && !hasIdentityVerification(profile)) missing.push("Identity verification is required.");
  if (policy.requireFoodHandlerCertificate && !hasApprovedCurrentCertificate(profile)) missing.push("Approved food handler certificate is required.");
  if (policy.requireLocalPermit && !hasApprovedCurrentPermit(profile)) missing.push("Approved local permit/license is required.");
  if (policy.requireKitchenReview && !profile.kitchenReviews.some((review) => review.status === "approved")) missing.push("Approved kitchen safety review is required.");
  if (policy.requireBackgroundCheck && !profile.backgroundChecks.some((check) => check.status === "clear")) missing.push("Clear background check is required.");
  if (policy.requirePayoutOnboarding && !isPayoutReady(payoutAccount)) missing.push("Payout onboarding must be complete.");
  return missing;
}

function hasIdentityVerification(profile: VerificationProfile) {
  return (
    profile.identityVerifications.some((verification) => verification.status === "verified") ||
    profile.items.some((item) => item.requirementType === "identity" && item.status === "approved")
  );
}

function hasApprovedCurrentCertificate(profile: VerificationProfile) {
  const now = Date.now();
  return profile.foodSafetyCertificates.some((certificate) =>
    certificate.status === "approved" && (!certificate.expiresAt || certificate.expiresAt.getTime() > now),
  );
}

function hasApprovedCurrentPermit(profile: VerificationProfile) {
  const now = Date.now();
  return profile.permits.some((permit) =>
    permit.status === "approved" && (!permit.expiresAt || permit.expiresAt.getTime() > now),
  );
}

function isPayoutReady(payoutAccount: { status: string; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean } | null) {
  return Boolean(payoutAccount?.status === "active" && payoutAccount.chargesEnabled && payoutAccount.payoutsEnabled && payoutAccount.detailsSubmitted);
}

function blockedCapabilitiesForPolicy(policy: NonNullable<Awaited<ReturnType<typeof resolveSellerVerificationPolicy>>>): GateCapability[] {
  const capabilities: GateCapability[] = [];
  if (!policy.allowPublicProfileBeforeVerification) capabilities.push("public_profile");
  if (!policy.allowMenuPublishingBeforeVerification) capabilities.push("menu_publishing");
  if (!policy.allowOrderAcceptanceBeforeVerification) capabilities.push("order_acceptance", "home_chef_assignment");
  if (!policy.allowPayoutsBeforeVerification) capabilities.push("payouts");
  return capabilities;
}

function isCapabilityAllowedBeforeVerification(
  policy: NonNullable<Awaited<ReturnType<typeof resolveSellerVerificationPolicy>>>,
  capability: GateCapability,
) {
  if (capability === "public_profile") return policy.allowPublicProfileBeforeVerification;
  if (capability === "menu_publishing") return policy.allowMenuPublishingBeforeVerification;
  if (capability === "order_acceptance" || capability === "home_chef_assignment") return policy.allowOrderAcceptanceBeforeVerification;
  if (capability === "payouts") return policy.allowPayoutsBeforeVerification;
  return false;
}

function policyScore(policy: { countryCode: string | null; region: string | null }, params: { countryCode?: string | null; region?: string | null }) {
  if (policy.countryCode && policy.countryCode === params.countryCode && policy.region && policy.region === params.region) return 4;
  if (policy.countryCode && policy.countryCode === params.countryCode && !policy.region) return 3;
  if (!policy.countryCode && !policy.region) return 1;
  return 0;
}
