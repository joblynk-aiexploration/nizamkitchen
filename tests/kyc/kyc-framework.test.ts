import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAudit } = vi.hoisted(() => ({
  mockPrisma: {
    kycProviderConfiguration: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    identityVerification: { create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    sellerVerificationItem: { upsert: vi.fn(), create: vi.fn() },
    sellerAttestation: { create: vi.fn() },
    sellerBackgroundCheck: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    kycWebhookEvent: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
  },
  mockAudit: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: "kyc-test-encryption-key-that-is-long-enough", APP_URL: "http://localhost:3000", NODE_ENV: "test" } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: mockAudit }));

import {
  collectBackgroundCheckConsent,
  recordKycWebhook,
  requestBackgroundCheck,
  saveKycProviderConfiguration,
  startIdentityVerification,
} from "@/server/kyc/kyc-service";

function adminSession(role = "platform_admin") {
  return { user: { id: "admin-1", status: "active", platformRole: role }, countryAssignments: [{ countryCode: "US" }] } as never;
}

function sellerSession(organizationType = "home_catering") {
  return {
    user: { id: "seller-user", status: "active", platformRole: null },
    activeOrganization: { id: "seller-org", countryCode: "US", organizationType, name: "Seller Org" },
    activeMembership: { role: "org_owner", status: "active" },
    countryAssignments: [],
  } as never;
}

describe("KYC provider and background-check framework", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.kycProviderConfiguration.create.mockImplementation(async ({ data }) => ({ id: "kyc-provider-1", createdAt: new Date(), updatedAt: new Date(), ...data }));
    mockPrisma.kycProviderConfiguration.findFirst.mockResolvedValue({
      id: "kyc-provider-1",
      provider: "persona_placeholder",
      displayName: "Persona placeholder",
      status: "active",
      environment: "sandbox",
      countryCode: null,
      supportedCountriesJson: ["US"],
      encryptedApiKey: null,
      encryptedSecret: null,
      encryptedWebhookSecret: null,
      settingsJson: null,
      createdById: "admin-1",
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      organizationId: "seller-org",
      countryCode: "US",
      sellerType: "home_catering",
      status: "in_progress",
      verificationLevel: "unverified",
      backgroundChecks: [],
    });
    mockPrisma.identityVerification.create.mockImplementation(async ({ data }) => ({ id: "identity-1", ...data }));
    mockPrisma.sellerVerificationItem.upsert.mockResolvedValue({ id: "item-identity" });
    mockPrisma.sellerAttestation.create.mockImplementation(async ({ data }) => ({ id: "attestation-1", ...data }));
    mockPrisma.sellerBackgroundCheck.create.mockImplementation(async ({ data }) => ({ id: "background-1", ...data }));
    mockPrisma.sellerBackgroundCheck.update.mockImplementation(async ({ data }) => ({ id: "background-1", ...data }));
    mockPrisma.kycWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.kycWebhookEvent.upsert.mockImplementation(async ({ create, update }) => ({ id: "webhook-1", ...create, ...update }));
  });

  it("encrypts provider secrets and returns only masked configuration details", async () => {
    const saved = await saveKycProviderConfiguration(adminSession(), {
      provider: "stripe_identity",
      displayName: "Stripe Identity",
      status: "active",
      environment: "sandbox",
      countryCode: "US",
      supportedCountries: "US,CA",
      apiKey: "pk_test_123456789",
      secret: "provider_secret_value_1234",
      webhookSecret: "whsec_secret_1234",
    });

    const stored = mockPrisma.kycProviderConfiguration.create.mock.calls[0][0].data;
    expect(stored.encryptedSecret).not.toContain("provider_secret_value_1234");
    expect(saved.secretConfigured).toBe(true);
    expect(JSON.stringify(saved)).not.toContain("provider_secret_value_1234");
  });

  it("creates identity sessions only for seller owner/admin organizations", async () => {
    await startIdentityVerification(sellerSession(), { provider: "persona_placeholder" });
    const householdSession = {
      user: { id: "household-user", status: "active", platformRole: null },
      activeOrganization: { id: "household-org", countryCode: "US", organizationType: "household", name: "Household" },
      activeMembership: { role: "member", status: "active" },
      countryAssignments: [],
    };
    await expect(startIdentityVerification(householdSession as never, { provider: "persona_placeholder" })).rejects.toThrow();
    expect(mockPrisma.identityVerification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "session_created", organizationId: "seller-org" }) }));
  });

  it("requires background-check consent before ordering a report", async () => {
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValueOnce({ id: "profile-1", organizationId: "seller-org", countryCode: "US", backgroundChecks: [] });
    await expect(requestBackgroundCheck(adminSession(), { verificationProfileId: "profile-1", provider: "manual" })).rejects.toThrow(/consent/i);

    await collectBackgroundCheckConsent(sellerSession(), { version: "v1", textSnapshot: "I consent to a background check before a report is ordered." });
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValueOnce({ id: "profile-1", organizationId: "seller-org", countryCode: "US", backgroundChecks: [{ id: "background-1", consentAttestationId: "attestation-1" }] });
    await requestBackgroundCheck(adminSession(), { verificationProfileId: "profile-1", provider: "checkr_placeholder" });
    expect(mockPrisma.sellerBackgroundCheck.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "pending", requestedById: "admin-1" }) }));
  });

  it("stores KYC webhook events idempotently without exposing secrets", async () => {
    const event = await recordKycWebhook("persona_placeholder", { rawBody: "{\"id\":\"evt_1\"}", headers: {} });
    expect(event.status).toBe("ignored");
    expect(mockPrisma.kycWebhookEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ provider: "persona_placeholder", signatureValid: false }),
    }));
  });
});
