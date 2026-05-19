import { PaymentOrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PaymentGatewayAdapter } from "@/server/payments/payment-gateway";
import { createPaymentOrderForModule } from "@/server/payments/payment-service";
import { syncModulePaymentStatus, validateRefundAmount } from "@/server/payments/operations";
import type { CreateCheckoutSessionInput, CreatePaymentIntentInput, RefundPaymentInput, WebhookHandleInput, WebhookValidationInput } from "@/server/payments/types";
import { getPayPalAccessToken, getPayPalGateway, getPayPalSecrets, paypalApiBase, paypalFetch } from "@/server/payments/providers/paypal/paypal-client";
import { handlePayPalWebhook, markPayPalOrderPaid, validatePayPalWebhook } from "@/server/payments/providers/paypal/paypal-webhooks";

type PayPalOrderResponse = {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string }>;
};

type PayPalCaptureResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string }> } }>;
};

export class PayPalPaymentGatewayAdapter implements PaymentGatewayAdapter {
  provider = "paypal" as const;

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    const gateway = await getPayPalGateway(undefined, input.metadata?.countryCode as string | undefined, input.currencyCode);
    const secrets = getPayPalSecrets(gateway);
    const apiBase = paypalApiBase(gateway.environment);
    const accessToken = await getPayPalAccessToken({ apiBase, clientId: secrets.clientId, clientSecret: secrets.clientSecret });
    const order = await paypalFetch<PayPalOrderResponse>({
      apiBase,
      accessToken,
      path: "/v2/checkout/orders",
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: input.paymentOrderId,
            amount: { currency_code: input.currencyCode, value: input.amount.toFixed(2) },
          },
        ],
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          user_action: "PAY_NOW",
        },
      },
    });
    return {
      provider: "paypal" as const,
      status: PaymentOrderStatus.checkout_created,
      checkoutUrl: order.links?.find((link) => link.rel === "approve")?.href,
      providerOrderId: order.id,
    };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput) {
    return { provider: "paypal" as const, status: PaymentOrderStatus.pending, providerOrderId: input.paymentOrderId };
  }

  async capturePayment(input: { providerOrderId?: string }) {
    if (!input.providerOrderId) throw new Error("PayPal order ID is required for capture.");
    const order = await prisma.paymentOrder.findFirstOrThrow({ where: { providerOrderId: input.providerOrderId } });
    const gateway = await getPayPalGateway(order.gatewayId, order.countryCode, order.currencyCode);
    const secrets = getPayPalSecrets(gateway);
    const apiBase = paypalApiBase(gateway.environment);
    const accessToken = await getPayPalAccessToken({ apiBase, clientId: secrets.clientId, clientSecret: secrets.clientSecret });
    const capture = await paypalFetch<PayPalCaptureResponse>({
      apiBase,
      accessToken,
      path: `/v2/checkout/orders/${input.providerOrderId}/capture`,
      method: "POST",
    });
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    await markPayPalOrderPaid(input.providerOrderId, captureId);
    return { provider: "paypal" as const, status: PaymentOrderStatus.paid, providerOrderId: input.providerOrderId, providerTransactionId: captureId };
  }

  async cancelPayment() {
    return { provider: "paypal" as const, status: PaymentOrderStatus.cancelled };
  }

  async refundPayment(input: RefundPaymentInput) {
    const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: input.paymentOrderId } });
    const transaction = await prisma.paymentTransaction.findFirst({ where: { paymentOrderId: order.id, provider: "paypal", transactionType: "charge", status: "succeeded" }, orderBy: { createdAt: "desc" } });
    if (!transaction?.providerTransactionId) throw new Error("A successful PayPal capture is required before refunding.");
    const gateway = await getPayPalGateway(order.gatewayId, order.countryCode, order.currencyCode);
    const secrets = getPayPalSecrets(gateway);
    const apiBase = paypalApiBase(gateway.environment);
    const accessToken = await getPayPalAccessToken({ apiBase, clientId: secrets.clientId, clientSecret: secrets.clientSecret });
    const refund = await paypalFetch<{ id: string }>({
      apiBase,
      accessToken,
      path: `/v2/payments/captures/${transaction.providerTransactionId}/refund`,
      method: "POST",
      body: { amount: { value: input.amount.toFixed(2), currency_code: input.currencyCode }, note_to_payer: input.reason },
    });
    return { provider: "paypal" as const, status: PaymentOrderStatus.partially_refunded, providerTransactionId: refund.id };
  }

  async getPaymentStatus(input: { providerOrderId?: string }) {
    return { provider: "paypal" as const, status: input.providerOrderId ? PaymentOrderStatus.pending : PaymentOrderStatus.draft, providerOrderId: input.providerOrderId };
  }

  async validateWebhook(input: WebhookValidationInput) {
    const valid = await validatePayPalWebhook({ rawBody: input.rawBody, headers: headersFromRecord(input.headers) });
    return { signatureValid: valid };
  }

  async handleWebhookEvent(input: WebhookHandleInput) {
    const result = await handlePayPalWebhook({ rawBody: input.rawBody, headers: headersFromRecord(input.headers), gatewayId: input.gatewayId });
    return { eventId: result.eventId, eventType: "paypal", signatureValid: true, handled: result.status === "processed", status: result.status };
  }

  supportsCountry() {
    return true;
  }

  supportsCurrency() {
    return true;
  }

  async getPublicClientConfig() {
    return { provider: "paypal", hostedCheckoutOnly: true, rawCardDataAllowed: false };
  }
}

export const paypalAdapter = new PayPalPaymentGatewayAdapter();

export async function createPayPalCheckoutForPaymentOrder(paymentOrderId: string, returnUrl: string, cancelUrl: string) {
  const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: paymentOrderId } });
  const result = await paypalAdapter.createCheckoutSession({
    paymentOrderId: order.id,
    amount: Number(order.amount),
    currencyCode: order.currencyCode,
    module: order.module,
    moduleEntityId: order.moduleEntityId,
    customerOrganizationId: order.customerOrganizationId ?? undefined,
    customerUserId: order.customerUserId ?? undefined,
    sellerOrganizationId: order.sellerOrganizationId ?? undefined,
    returnUrl,
    cancelUrl,
    metadata: { countryCode: order.countryCode },
  });
  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: "checkout_created", checkoutUrl: result.checkoutUrl ?? null, providerOrderId: result.providerOrderId ?? null },
  });
  return result;
}

export async function createPayPalFoodOrderCheckout(params: { foodOrderId: string; userId: string; appUrl: string }) {
  const order = await prisma.foodOrder.findUniqueOrThrow({ where: { id: params.foodOrderId } });
  if (!order.subtotalAmount || order.subtotalAmount <= 0) throw new Error("This order does not have a payable amount.");
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    customerOrganizationId: order.customerOrganizationId,
    customerUserId: params.userId,
    sellerOrganizationId: order.sellerOrganizationId,
    module: "food_order",
    moduleEntityId: order.id,
    provider: "paypal",
    amount: order.subtotalAmount,
    currencyCode: order.currencyCode,
    idempotencyKey: `food-order:${order.id}:paypal`,
  });
  await prisma.foodOrder.update({ where: { id: order.id }, data: { paymentRequired: true, paymentStatus: "pending", paymentOrderId: paymentOrder.id } });
  return createPayPalCheckoutForPaymentOrder(paymentOrder.id, `${params.appUrl}/api/payments/paypal/capture?orderId=${paymentOrder.id}`, `${params.appUrl}/orders/${order.id}?payment=cancelled`);
}

export async function createPayPalHomeChefCheckout(params: { requestId: string; userId: string; appUrl: string; paymentType: "deposit" | "full" }) {
  const request = await prisma.homeChefRequest.findUniqueOrThrow({ where: { id: params.requestId } });
  const amount = params.paymentType === "deposit" ? request.depositAmount : request.quotedAmount;
  if (!amount || amount <= 0) throw new Error("This home chef request does not have a payable quote yet.");
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    customerOrganizationId: request.organizationId,
    customerUserId: params.userId,
    sellerOrganizationId: request.assignedChefOrganizationId ?? undefined,
    module: "home_chef_request",
    moduleEntityId: request.id,
    provider: "paypal",
    amount,
    currencyCode: request.currencyCode,
    idempotencyKey: `home-chef:${request.id}:${params.paymentType}:paypal`,
    metadataJson: { paymentType: params.paymentType },
  });
  await prisma.homeChefRequest.update({ where: { id: request.id }, data: { paymentRequired: true, paymentStatus: "pending", paymentOrderId: paymentOrder.id } });
  return createPayPalCheckoutForPaymentOrder(paymentOrder.id, `${params.appUrl}/api/payments/paypal/capture?orderId=${paymentOrder.id}`, `${params.appUrl}/home-chef/requests/${request.id}?payment=cancelled`);
}

export async function createPayPalRefundForPaymentOrder(params: { paymentOrderId: string; amount: number; reason?: string; requestedById: string }) {
  const { order, remaining } = await validateRefundAmount(params.paymentOrderId, params.amount);
  const result = await paypalAdapter.refundPayment({ paymentOrderId: order.id, amount: params.amount, currencyCode: order.currencyCode, reason: params.reason });
  const refund = await prisma.paymentRefund.create({
    data: {
      paymentOrderId: order.id,
      organizationId: order.organizationId,
      provider: "paypal",
      gatewayId: order.gatewayId,
      status: "processing",
      amount: new Prisma.Decimal(params.amount),
      currencyCode: order.currencyCode,
      reason: params.reason ?? null,
      providerRefundId: result.providerTransactionId ?? null,
      requestedById: params.requestedById,
    },
  });
  const fullRefund = params.amount >= remaining;
  await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: fullRefund ? "refunded" : "partially_refunded" } });
  await syncModulePaymentStatus(order.id, fullRefund ? "refunded" : "partially_refunded");
  return refund;
}

function headersFromRecord(record: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) headers.set(key, value[0] ?? "");
    else if (value) headers.set(key, value);
  }
  return headers;
}
