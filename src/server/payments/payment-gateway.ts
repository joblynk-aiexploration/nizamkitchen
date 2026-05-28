import { PaymentProvider } from "@prisma/client";
import type {
  CreateCheckoutSessionInput,
  CreatePaymentIntentInput,
  NormalizedCheckoutResult,
  NormalizedPaymentResult,
  NormalizedWebhookResult,
  PaymentStatusInput,
  RefundPaymentInput,
  WebhookHandleInput,
  WebhookValidationInput,
} from "@/server/payments/types";

export interface PaymentGatewayAdapter {
  provider: PaymentProvider;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<NormalizedCheckoutResult>;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<NormalizedPaymentResult>;
  capturePayment(input: PaymentStatusInput): Promise<NormalizedPaymentResult>;
  cancelPayment(input: PaymentStatusInput): Promise<NormalizedPaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<NormalizedPaymentResult>;
  getPaymentStatus(input: PaymentStatusInput): Promise<NormalizedPaymentResult>;
  validateWebhook(input: WebhookValidationInput): Promise<{ signatureValid: boolean; eventId?: string; eventType?: string }>;
  handleWebhookEvent(input: WebhookHandleInput): Promise<NormalizedWebhookResult>;
  supportsCountry(countryCode: string): boolean;
  supportsCurrency(currencyCode: string): boolean;
  getPublicClientConfig(input: { countryCode?: string; currencyCode?: string }): Promise<Record<string, string | boolean>>;
}
