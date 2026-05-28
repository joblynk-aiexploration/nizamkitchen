# PayPal Setup

PayPal checkout is supported for food orders and home chef quote/deposit payments.

## Credentials

Create a PayPal gateway in `/admin/payments/gateways` and save:

- `client_id`
- `client_secret`
- `webhook_id`

Secrets are encrypted at rest and displayed only as masked previews.

## Checkout behavior

The app creates a PayPal order server-side and redirects the buyer to PayPal. On return, the capture route verifies the local `PaymentOrder` matches the PayPal token before attempting capture.

PayPal `CHECKOUT.ORDER.APPROVED` webhooks do not mark orders paid. Payment is marked paid only after server capture or trusted completed/capture webhook processing.

## Webhooks

Configure PayPal webhooks to:

```text
https://YOUR_APP_URL/api/payments/paypal/webhook
```

Relevant events:

- `CHECKOUT.ORDER.COMPLETED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`

Webhook verification uses PayPal's verification endpoint when `webhook_id` is configured.

## Limitations

PayPal seller marketplace payouts are not implemented in this version. Use manual reconciliation or Stripe Connect for marketplace payout automation.
