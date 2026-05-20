import type { KycProviderAdapter, KycProviderConfig } from "@/server/kyc/kyc-provider";

export class PersonaPlaceholderProvider implements KycProviderAdapter {
  provider = "persona_placeholder" as const;
  constructor(private config?: KycProviderConfig | null) {}

  async createVerificationSession() {
    if (!this.config) throw new Error("Persona identity provider is not configured.");
    return {
      provider: this.provider,
      providerSessionId: `persona_placeholder_${Date.now()}`,
      providerStatus: "placeholder",
      status: "session_created" as const,
      verificationUrl: null,
      expiresAt: null,
      metadata: { providerReady: false },
    };
  }

  async getVerificationStatus() {
    return { provider: this.provider, providerStatus: "placeholder", status: "pending" as const };
  }

  async handleWebhook() {
    return { eventId: `persona_${Date.now()}`, eventType: "placeholder.unhandled", signatureValid: false, status: "ignored" as const, message: "Persona webhook placeholder only." };
  }

  async cancelVerification(input: { providerSessionId: string }) {
    return { provider: this.provider, providerSessionId: input.providerSessionId, providerStatus: "cancelled", status: "cancelled" as const };
  }
}
