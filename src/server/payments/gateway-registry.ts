import { PaymentOrderStatus, PaymentProvider } from "@prisma/client";
import { PaymentGatewayUnavailableError } from "@/server/payments/payment-errors";
import type { PaymentGatewayAdapter } from "@/server/payments/payment-gateway";
import { paypalAdapter } from "@/server/payments/providers/paypal/paypal-adapter";
import { stripeAdapter } from "@/server/payments/providers/stripe/stripe-adapter";
import type {
  CreateCheckoutSessionInput,
  CreatePaymentIntentInput,
  NormalizedPaymentResult,
  PaymentStatusInput,
  RefundPaymentInput,
  WebhookHandleInput,
  WebhookValidationInput,
} from "@/server/payments/types";

class PlaceholderGatewayAdapter implements PaymentGatewayAdapter {
  constructor(
    public readonly provider: PaymentProvider,
    private readonly options: { countries?: string[]; currencies?: string[]; manual?: boolean } = {},
  ) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    if (!this.options.manual) {
      throw new PaymentGatewayUnavailableError(`${this.provider} checkout is registered but no provider SDK is connected yet.`);
    }
    return {
      provider: this.provider,
      status: PaymentOrderStatus.checkout_created,
      checkoutUrl: input.returnUrl,
    };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<NormalizedPaymentResult> {
    return { provider: this.provider, status: this.options.manual ? PaymentOrderStatus.pending : PaymentOrderStatus.draft, providerOrderId: input.paymentOrderId };
  }

  async capturePayment(input: PaymentStatusInput): Promise<NormalizedPaymentResult> {
    return { provider: this.provider, status: PaymentOrderStatus.paid, providerOrderId: input.providerOrderId };
  }

  async cancelPayment(input: PaymentStatusInput): Promise<NormalizedPaymentResult> {
    return { provider: this.provider, status: PaymentOrderStatus.cancelled, providerOrderId: input.providerOrderId };
  }

  async refundPayment(input: RefundPaymentInput): Promise<NormalizedPaymentResult> {
    return { provider: this.provider, status: PaymentOrderStatus.refunded, providerOrderId: input.paymentOrderId };
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<NormalizedPaymentResult> {
    return { provider: this.provider, status: PaymentOrderStatus.pending, providerOrderId: input.providerOrderId };
  }

  async validateWebhook(input: WebhookValidationInput) {
    return { signatureValid: Boolean(this.options.manual), eventId: `manual-${input.rawBody.length}`, eventType: "manual.placeholder" };
  }

  async handleWebhookEvent(input: WebhookHandleInput) {
    return {
      eventId: `manual-${input.rawBody.length}`,
      eventType: "manual.placeholder",
      signatureValid: Boolean(this.options.manual),
      handled: Boolean(this.options.manual),
      status: this.options.manual ? "processed" : "ignored",
    } as const;
  }

  supportsCountry(countryCode: string) {
    return !this.options.countries?.length || this.options.countries.includes(countryCode.toUpperCase());
  }

  supportsCurrency(currencyCode: string) {
    return !this.options.currencies?.length || this.options.currencies.includes(currencyCode.toUpperCase());
  }

  async getPublicClientConfig() {
    return { provider: this.provider, hostedCheckoutOnly: true, rawCardDataAllowed: false };
  }
}

const registry = new Map<PaymentProvider, PaymentGatewayAdapter>();

for (const provider of Object.values(PaymentProvider)) {
  registry.set(provider, new PlaceholderGatewayAdapter(provider, { manual: provider === PaymentProvider.manual || provider === PaymentProvider.cash }));
}
registry.set(PaymentProvider.stripe, stripeAdapter);
registry.set(PaymentProvider.paypal, paypalAdapter);

export function registerPaymentGateway(adapter: PaymentGatewayAdapter) {
  registry.set(adapter.provider, adapter);
}

export function getPaymentGatewayAdapter(provider: PaymentProvider) {
  const adapter = registry.get(provider);
  if (!adapter) throw new PaymentGatewayUnavailableError(`Payment provider ${provider} is not registered.`);
  return adapter;
}

export function listRegisteredPaymentProviders() {
  return Array.from(registry.keys());
}
