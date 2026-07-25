import type { EmailTemplateCategory } from "@prisma/client";

export type EmailTemplateSeed = {
  templateKey: string;
  name: string;
  description?: string;
  category: EmailTemplateCategory;
  subject: string;
  preheader?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrlVariable?: string;
  variables?: Array<{
    key: string;
    description?: string;
    example?: string;
    required?: boolean;
  }>;
  marketing?: boolean;
};

export type EmailRenderInput = {
  templateKey: string;
  variables: Record<string, unknown>;
  locale?: string | null;
  countryCode?: string | null;
};

export type RenderedEmail = {
  subject: string;
  preheader?: string | null;
  html: string;
  text: string;
  missingVariables: string[];
};

export type SendEmailInput = EmailRenderInput & {
  to: string;
  recipientUserId?: string | null;
  organizationId?: string | null;
  countryCode?: string | null;
  category?: EmailTemplateCategory;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  deliveryTimeoutMs?: number;
};

export type EmailProviderSendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  timeoutMs?: number;
};

export type EmailProviderSendResult = {
  sent: boolean;
  provider: "disabled" | "smtp";
  providerMessageId?: string | null;
  errorMessage?: string | null;
};

export type EmailProviderAdapter = {
  provider: "disabled" | "smtp";
  send(input: EmailProviderSendInput): Promise<EmailProviderSendResult>;
};
