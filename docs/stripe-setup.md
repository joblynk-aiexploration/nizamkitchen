# Stripe Setup

Stripe is the primary production gateway for hosted checkout, subscriptions, and marketplace seller onboarding.

## Credentials

Create a Stripe gateway in `/admin/payments/gateways` and save:

- `publishable_key`
- `secret_key`
- `webhook_secret`

The secret key and webhook secret are encrypted at rest. Full values are never displayed after save.

## Webhooks

Configure Stripe to send webhooks to:

```text
https://YOUR_APP_URL/api/payments/stripe/webhook
```

Required event coverage:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `account.updated`

Webhook signatures are required. Duplicate processed events are ignored.

## Stripe Connect

Seller organizations use `/settings/payments` to start Connect onboarding. Live marketplace payment should require a connected seller account with charges enabled unless the country configuration intentionally allows manual/offline settlement.

## Subscriptions

Billing plans use Stripe Price IDs configured server-side. Users cannot submit their own price amount or Price ID from the client.
