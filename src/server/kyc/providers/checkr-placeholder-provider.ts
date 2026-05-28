import type { BackgroundCheckProvider, BackgroundCheckProviderInput, BackgroundCheckProviderResult } from "@/server/kyc/background-check-service";
import type { KycProviderAdapter, KycVerificationSessionResult } from "@/server/kyc/kyc-provider";

export class CheckrPlaceholderBackgroundProvider implements BackgroundCheckProvider {
  provider = "checkr_placeholder" as const;

  async createCandidate(input: BackgroundCheckProviderInput): Promise<BackgroundCheckProviderResult> {
    return { provider: this.provider, providerCandidateId: `candidate_${input.organizationId}`, status: "consent_collected" };
  }

  async collectAuthorization(input: BackgroundCheckProviderInput): Promise<BackgroundCheckProviderResult> {
    return { provider: this.provider, providerCandidateId: `candidate_${input.organizationId}`, status: "consent_collected" };
  }

  async orderReport(input: BackgroundCheckProviderInput): Promise<BackgroundCheckProviderResult> {
    if (!input.consentAttestationId) throw new Error("Background checks require consent before they are ordered.");
    return { provider: this.provider, providerCandidateId: `candidate_${input.organizationId}`, providerReportId: `report_${Date.now()}`, status: "pending" };
  }

  async getReportStatus(): Promise<BackgroundCheckProviderResult> {
    return { provider: this.provider, status: "pending" };
  }

  async handleWebhook(): Promise<BackgroundCheckProviderResult> {
    return { provider: this.provider, status: "pending" };
  }
}

export class CheckrPlaceholderKycProvider implements KycProviderAdapter {
  provider = "checkr_placeholder" as const;
  async createVerificationSession(): Promise<KycVerificationSessionResult> {
    throw new Error("Checkr is a background-check provider, not an identity verification flow.");
  }
  async getVerificationStatus(): Promise<KycVerificationSessionResult> {
    throw new Error("Checkr identity status is not available.");
  }
  async handleWebhook() {
    return { eventId: `checkr_${Date.now()}`, eventType: "placeholder.unhandled", signatureValid: false, status: "ignored" as const };
  }
  async cancelVerification(): Promise<KycVerificationSessionResult> {
    throw new Error("Checkr identity cancellation is not available.");
  }
}
