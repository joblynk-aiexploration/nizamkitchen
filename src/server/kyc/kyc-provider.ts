import type { IdentityVerificationStatus, KycProvider } from "@prisma/client";

export type KycProviderConfig = {
  id: string;
  provider: KycProvider;
  environment: "sandbox" | "live";
  apiKey?: string | null;
  secret?: string | null;
  webhookSecret?: string | null;
  settings?: unknown;
};

export type CreateVerificationSessionInput = {
  organizationId: string;
  verificationProfileId: string;
  userId: string;
  returnUrl?: string | null;
};

export type KycVerificationSessionResult = {
  provider: KycProvider;
  providerSessionId?: string | null;
  providerStatus?: string | null;
  status: IdentityVerificationStatus;
  verificationUrl?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export type KycWebhookInput = {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
};

export type KycWebhookResult = {
  eventId: string;
  eventType: string;
  signatureValid: boolean;
  status: "processed" | "ignored" | "failed";
  providerSessionId?: string | null;
  providerStatus?: string | null;
  identityStatus?: IdentityVerificationStatus;
  message?: string;
};

export interface KycProviderAdapter {
  provider: KycProvider;
  createVerificationSession(input: CreateVerificationSessionInput): Promise<KycVerificationSessionResult>;
  getVerificationStatus(input: { providerSessionId: string }): Promise<KycVerificationSessionResult>;
  handleWebhook(input: KycWebhookInput): Promise<KycWebhookResult>;
  cancelVerification(input: { providerSessionId: string }): Promise<KycVerificationSessionResult>;
}
