import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent } = vi.hoisted(() => ({
  mockPrisma: {
    marketplacePolicy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    marketplacePolicyOverride: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    marketplacePolicyEvaluationLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    sellerVerificationPolicy: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerPayoutAccount: { findFirst: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  createAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));

import { evaluatePolicy, requirePolicyAllowed } from "@/server/policies/policy-service";
import { getSellerVerificationGate } from "@/server/seller-verification-gates";

function policy(overrides = {}) {
  return {
    id: "policy-1",
    name: "Global menu publishing",
    description: null,
    countryCode: null,
    region: null,
    sellerType: null,
    organizationType: null,
    module: "menu_publishing",
    status: "active",
    priority: 10,
    rulesJson: { requireSellerVerified: true, message: "Complete seller verification before publishing menu items." },
    createdById: "admin-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("marketplace policy engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.marketplacePolicy.findMany.mockResolvedValue([policy()]);
    mockPrisma.marketplacePolicyOverride.findFirst.mockResolvedValue(null);
    mockPrisma.marketplacePolicyEvaluationLog.create.mockResolvedValue({ id: "log-1" });
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
  });

  it("applies a global policy", async () => {
    const result = await evaluatePolicy({
      module: "menu_publishing",
      action: "publish",
      organizationId: "seller-org",
      metadata: { sellerVerified: false },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Complete seller verification");
  });

  it("prefers country policy over global policy", async () => {
    mockPrisma.marketplacePolicy.findMany.mockResolvedValue([
      policy({ id: "global", priority: 1 }),
      policy({ id: "country", name: "US policy", countryCode: "US", priority: 20, rulesJson: { effect: "allowed" } }),
    ]);

    const result = await evaluatePolicy({
      module: "menu_publishing",
      action: "publish",
      countryCode: "US",
      metadata: { sellerVerified: false },
    });

    expect(result.allowed).toBe(true);
    expect(result.policyId).toBe("country");
  });

  it("supports seller-type policy matching", async () => {
    mockPrisma.marketplacePolicy.findMany.mockResolvedValue([
      policy({ id: "chef-policy", sellerType: "chef_business", priority: 50, rulesJson: { requireSellerVerified: true } }),
    ]);

    await expect(requirePolicyAllowed({
      module: "home_chef_requests",
      action: "assign",
      sellerType: "chef_business",
      metadata: { sellerVerified: false },
    })).rejects.toThrow("Seller verification is required");
  });

  it("organization override allows a blocked policy", async () => {
    mockPrisma.marketplacePolicyOverride.findFirst.mockResolvedValue({ id: "override-1" });
    const result = await evaluatePolicy({
      module: "menu_publishing",
      action: "publish",
      organizationId: "seller-org",
      metadata: { sellerVerified: false },
    });

    expect(result.allowed).toBe(true);
    expect(result.overrideActive).toBe(true);
  });

  it("expired override does not apply", async () => {
    mockPrisma.marketplacePolicyOverride.findFirst.mockResolvedValue(null);
    const result = await evaluatePolicy({
      module: "menu_publishing",
      action: "publish",
      organizationId: "seller-org",
      metadata: { sellerVerified: false },
    });

    expect(result.allowed).toBe(false);
  });

  it("integrates with seller verification gates for menu publishing", async () => {
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([{
      id: "verification-policy",
      policyName: "Verification gate",
      countryCode: "US",
      region: null,
      sellerType: "home_catering",
      status: "active",
      allowPublicProfileBeforeVerification: false,
      allowMenuPublishingBeforeVerification: false,
      allowOrderAcceptanceBeforeVerification: false,
      allowPayoutsBeforeVerification: false,
      requireAdminApproval: true,
      requireIdentityVerification: false,
      requireFoodHandlerCertificate: false,
      requireLocalPermit: false,
      requireKitchenReview: false,
      requireBackgroundCheck: false,
      requirePayoutOnboarding: false,
      updatedAt: new Date(),
    }]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue({ status: "submitted", items: [], foodSafetyCertificates: [], permits: [], kitchenReviews: [], backgroundChecks: [], identityVerifications: [] });

    const result = await getSellerVerificationGate({
      organizationId: "seller-org",
      sellerType: "home_catering",
      countryCode: "US",
      capability: "menu_publishing",
    });

    expect(result.allowed).toBe(false);
    expect(result.missingRequirements.join(" ")).toContain("Complete seller verification");
  });

  it("logs denied evaluations for audit visibility", async () => {
    await evaluatePolicy({
      module: "payouts",
      action: "payout",
      organizationId: "seller-org",
      countryCode: "US",
      metadata: { sellerVerified: false },
    });

    expect(mockPrisma.marketplacePolicyEvaluationLog.create).toHaveBeenCalled();
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "marketplace_policy.evaluated_denied" }));
  });
});
