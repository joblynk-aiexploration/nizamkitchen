import type { KycProviderAdapter, KycProviderConfig } from "@/server/kyc/kyc-provider";

export class StripeConnectProvider implements KycProviderAdapter {
  provider = "stripe_connect" as const;
  constructor(private config?: KycProviderConfig | null) {}

  async createVerificationSession() {
    if (!this.config?.secret && !this.config?.apiKey) throw new Error("Stripe Connect provider is not configured.");
    return {
      provider: this.provider,
      providerSessionId: `acct_onboarding_placeholder_${Date.now()}`,
      providerStatus: "onboarding_required",
      status: "session_created" as const,
      verificationUrl: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: { providerReady: false, note: "Stripe Connect onboarding already owns payout readiness." },
    };
  }

  async getVerificationStatus(input: { providerSessionId: string }) {
    return { provider: this.provider, providerSessionId: input.providerSessionId, providerStatus: "pending", status: "pending" as const };
  }

  async handleWebhook() {
    return { eventId: `stripe_connect_${Date.now()}`, eventType: "account.placeholder", signatureValid: false, status: "ignored" as const };
  }

  async cancelVerification(input: { providerSessionId: string }) {
    return { provider: this.provider, providerSessionId: input.providerSessionId, providerStatus: "cancelled", status: "cancelled" as const };
  }
}
