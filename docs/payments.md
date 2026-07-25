# Payments

NizamKitchen uses a provider-agnostic payment layer with admin-controlled gateway configuration.

## Current Capabilities

- Stripe hosted checkout for supported flows
- PayPal checkout for supported flows
- Stripe subscriptions
- Stripe Connect payout onboarding for supported seller types
- Manual/offline payment support where policy allows
- Webhook storage and idempotent processing
- Refund, dispute, commission, and payout operations pages

## Core Admin Pages

- `/admin/payments`
- `/admin/payments/gateways`
- `/admin/payments/configurations`
- `/admin/payments/operations`
- `/admin/payments/transactions`
- `/admin/payments/refunds`
- `/admin/payments/disputes`
- `/admin/payments/payouts`
- `/admin/payments/commissions`
- `/admin/payments/webhooks`

## Security Rules

- No raw card numbers are stored.
- No CVV is stored.
- Secret gateway credentials are encrypted with `ENCRYPTION_KEY`.
- Admin users only see masked previews after save.
- Amounts, commissions, and seller payouts are calculated server-side.
- Webhook events are the trusted source for final provider state.

## Environment and Setup

Common payment-related variables:

```bash
ENCRYPTION_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
```

The app must stay stable if payment credentials are missing. Missing gateways should show setup or disabled states, not runtime crashes.

## What Is Still Placeholder

- Some future gateway adapters are shells only.
- Direct Google Pay token processing is not enabled.
- Certain dispute evidence and manual reconciliation actions still require operator review.
- Country-specific payout behavior may still require admin setup before live marketplace checkout is allowed.

## Launch Checklist

- Confirm `ENCRYPTION_KEY` is set.
- Configure live or sandbox gateways from the admin panel.
- Verify webhook endpoints and signatures.
- Verify payout onboarding requirements for seller types.
- Verify refunds and admin-only payment operations are permission-checked.
