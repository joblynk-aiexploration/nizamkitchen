import crypto from "node:crypto";
import type { KycProviderAdapter, KycProviderConfig, KycWebhookInput } from "@/server/kyc/kyc-provider";

export class StripeIdentityProvider implements KycProviderAdapter {
  provider = "stripe_identity" as const;
  constructor(private config?: KycProviderConfig | null) {}

  async createVerificationSession() {
    if (!this.config?.secret && !this.config?.apiKey) throw new Error("Stripe Identity provider is not configured.");
    return {
      provider: this.provider,
      providerSessionId: `vs_placeholder_${Date.now()}`,
      providerStatus: "requires_input",
      status: "session_created" as const,
      verificationUrl: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: { providerReady: false, note: "Stripe Identity SDK wiring placeholder." },
    };
  }

  async getVerificationStatus(input: { providerSessionId: string }) {
    return { provider: this.provider, providerSessionId: input.providerSessionId, providerStatus: "processing", status: "pending" as const };
  }

  async handleWebhook(input: KycWebhookInput) {
    const signatureValid = Boolean(this.config?.webhookSecret && verifySimpleHmac(input.rawBody, header(input.headers, "stripe-signature"), this.config.webhookSecret));
    return { eventId: `stripe_identity_${Date.now()}`, eventType: "identity.placeholder", signatureValid, status: signatureValid ? "processed" as const : "failed" as const };
  }

  async cancelVerification(input: { providerSessionId: string }) {
    return { provider: this.provider, providerSessionId: input.providerSessionId, providerStatus: "cancelled", status: "cancelled" as const };
  }
}

function header(headers: Record<string, string | string[] | undefined>, key: string) {
  const value = headers[key] ?? headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function verifySimpleHmac(payload: string, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return signature.includes(digest);
}
