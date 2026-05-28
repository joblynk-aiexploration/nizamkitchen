import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent } = vi.hoisted(() => ({
  mockPrisma: {
    sellerVerificationPolicy: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerPayoutAccount: { findFirst: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  createAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));

import {
  getSellerVerificationGate,
  grantSellerVerificationOverride,
  revokeSellerVerificationOverride,
} from "@/server/seller-verification-gates";

function policy(overrides = {}) {
  return {
    id: "policy-1",
    policyName: "Strict seller policy",
    countryCode: "US",
    region: null,
    sellerType: "home_catering",
    status: "active",
    allowPublicProfileBeforeVerification: false,
    allowMenuPublishingBeforeVerification: false,
    allowOrderAcceptanceBeforeVerification: false,
    allowPayoutsBeforeVerification: false,
    requireAdminApproval: true,
    requireIdentityVerification: true,
    requireFoodHandlerCertificate: true,
    requireLocalPermit: false,
    requireKitchenReview: false,
    requireBackgroundCheck: false,
    requirePayoutOnboarding: true,
    updatedAt: new Date(),
    ...overrides,
  };
}

function verifiedProfile() {
  return {
    status: "verified",
    items: [],
    foodSafetyCertificates: [{ status: "approved", expiresAt: new Date(Date.now() + 86400000) }],
    permits: [],
    kitchenReviews: [],
    backgroundChecks: [],
    identityVerifications: [{ status: "verified" }],
  };
}

describe("seller verification marketplace gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([policy()]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
  });

  it("hides unverified public profiles when policy blocks public visibility", async () => {
    const gate = await getSellerVerificationGate({
      organizationId: "seller-org",
      sellerType: "home_catering",
      countryCode: "US",
      capability: "public_profile",
    });

    expect(gate.allowed).toBe(false);
    expect(gate.missingRequirements).toContain("Create and submit a seller verification profile.");
  });

  it("requires payout onboarding when policy blocks live marketplace payouts", async () => {
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(verifiedProfile());
    const gate = await getSellerVerificationGate({
      organizationId: "seller-org",
      sellerType: "home_catering",
      countryCode: "US",
      capability: "payouts",
    });

    expect(gate.allowed).toBe(false);
    expect(gate.missingRequirements).toContain("Payout onboarding must be complete.");
  });

  it("allows payouts once required verification and payout onboarding are complete", async () => {
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(verifiedProfile());
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue({ status: "active", chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true });

    const gate = await getSellerVerificationGate({
      organizationId: "seller-org",
      sellerType: "home_catering",
      countryCode: "US",
      capability: "payouts",
    });

    expect(gate.allowed).toBe(true);
  });

  it("expired override no longer allows gated actions", async () => {
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
    const gate = await getSellerVerificationGate({
      organizationId: "seller-org",
      sellerType: "home_catering",
      countryCode: "US",
      capability: "order_acceptance",
    });

    expect(gate.allowed).toBe(false);
  });

  it("platform admin can grant and revoke an override with audit logs", async () => {
    const session = { user: { id: "admin-1", platformRole: "platform_owner" }, countryAssignments: [] } as never;
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "seller-org", countryCode: "US" });
    mockPrisma.sellerVerificationOverride.create.mockResolvedValue({ id: "override-1", organizationId: "seller-org", policyId: null, expiresAt: null, reason: "Launch exception" });
    mockPrisma.sellerVerificationOverride.findUnique.mockResolvedValue({ id: "override-1", organizationId: "seller-org", policyId: null, organization: { countryCode: "US" } });
    mockPrisma.sellerVerificationOverride.update.mockResolvedValue({ id: "override-1", organizationId: "seller-org", policyId: null });

    await grantSellerVerificationOverride(session, { organizationId: "seller-org", reason: "Launch exception approved", expiresAt: null });
    await revokeSellerVerificationOverride(session, { overrideId: "override-1" });

    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "seller_verification_override.granted" }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "seller_verification_override.revoked" }));
  });
});
