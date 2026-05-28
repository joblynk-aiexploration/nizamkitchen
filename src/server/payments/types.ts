import type { PaymentModule, PaymentOrderStatus, PaymentProvider } from "@prisma/client";

export type MoneyInput = {
  amount: number;
  currencyCode: string;
};

export type PaymentCustomerInput = {
  customerOrganizationId?: string;
  customerUserId?: string;
  email?: string;
  name?: string;
};

export type PaymentSellerInput = {
  sellerOrganizationId?: string;
};

export type PaymentModuleInput = {
  module: PaymentModule;
  moduleEntityId: string;
};

export type CreateCheckoutSessionInput = MoneyInput &
  PaymentCustomerInput &
  PaymentSellerInput &
  PaymentModuleInput & {
    paymentOrderId: string;
    returnUrl: string;
    cancelUrl: string;
    metadata?: Record<string, unknown>;
  };

export type CreatePaymentIntentInput = MoneyInput &
  PaymentCustomerInput &
  PaymentSellerInput &
  PaymentModuleInput & {
    paymentOrderId: string;
    metadata?: Record<string, unknown>;
  };

export type PaymentStatusInput = {
  providerOrderId?: string;
  providerPaymentIntentId?: string;
  providerCheckoutSessionId?: string;
};

export type RefundPaymentInput = {
  paymentOrderId: string;
  amount: number;
  currencyCode: string;
  reason?: string;
};

export type WebhookValidationInput = {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
};

export type WebhookHandleInput = WebhookValidationInput & {
  gatewayId?: string;
};

export type NormalizedCheckoutResult = {
  provider: PaymentProvider;
  status: PaymentOrderStatus;
  checkoutUrl?: string;
  providerOrderId?: string;
  providerPaymentIntentId?: string;
  providerCheckoutSessionId?: string;
  expiresAt?: Date;
};

export type NormalizedPaymentResult = {
  provider: PaymentProvider;
  status: PaymentOrderStatus;
  providerOrderId?: string;
  providerPaymentIntentId?: string;
  providerTransactionId?: string;
  failureCode?: string;
  failureMessage?: string;
};

export type NormalizedWebhookResult = {
  eventId: string;
  eventType: string;
  signatureValid: boolean;
  handled: boolean;
  status: "processed" | "ignored" | "failed";
  message?: string;
};
