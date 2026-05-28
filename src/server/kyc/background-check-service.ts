import type { BackgroundCheckStatus, VerificationProvider } from "@prisma/client";

export type BackgroundCheckProviderInput = {
  organizationId: string;
  verificationProfileId: string;
  consentAttestationId?: string | null;
};

export type BackgroundCheckProviderResult = {
  provider: VerificationProvider;
  providerCandidateId?: string | null;
  providerReportId?: string | null;
  status: BackgroundCheckStatus;
  resultSummary?: string | null;
};

export interface BackgroundCheckProvider {
  provider: VerificationProvider;
  createCandidate(input: BackgroundCheckProviderInput): Promise<BackgroundCheckProviderResult>;
  collectAuthorization(input: BackgroundCheckProviderInput): Promise<BackgroundCheckProviderResult>;
  orderReport(input: BackgroundCheckProviderInput): Promise<BackgroundCheckProviderResult>;
  getReportStatus(input: { providerReportId: string }): Promise<BackgroundCheckProviderResult>;
  handleWebhook(input: { rawBody: string; headers: Record<string, string | string[] | undefined> }): Promise<BackgroundCheckProviderResult>;
}

export class MissingBackgroundCheckProvider implements BackgroundCheckProvider {
  provider = "local_admin_review" as const;
  async createCandidate(): Promise<BackgroundCheckProviderResult> {
    throw new Error("Background check provider is not configured.");
  }
  async collectAuthorization(): Promise<BackgroundCheckProviderResult> {
    throw new Error("Background check provider is not configured.");
  }
  async orderReport(): Promise<BackgroundCheckProviderResult> {
    throw new Error("Background check provider is not configured.");
  }
  async getReportStatus(): Promise<BackgroundCheckProviderResult> {
    throw new Error("Background check provider is not configured.");
  }
  async handleWebhook(): Promise<BackgroundCheckProviderResult> {
    throw new Error("Background check provider is not configured.");
  }
}
