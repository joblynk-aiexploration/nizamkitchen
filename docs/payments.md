# NizamKitchen Payments

NizamKitchen uses a provider-agnostic payment layer. Product modules create a `PaymentOrder`; gateway adapters create hosted checkout sessions or provider orders; webhooks are the trusted source for final payment state.

## Supported flows

- Food orders: Stripe Checkout or PayPal checkout can collect payment for menu order requests.
- Home chef requests: admins can quote a full amount or deposit, then households can pay through configured gateways.
- Billing subscriptions: Stripe subscription checkout is supported through admin-configured Stripe Price IDs.
- Seller payouts: Stripe Connect onboarding is available for home catering, restaurant, and chef business organizations.
- Manual/offline payments: admins can reconcile cash, bank transfer, or direct seller payments when enabled.

## Production safety rules

- NizamKitchen never stores raw card numbers, CVV, or custom card forms.
- Gateway secret keys are stored encrypted with `ENCRYPTION_KEY`.
- Only masked credential previews are shown after save.
- Amounts, taxes, platform commission, and seller amounts are calculated server-side.
- Clients cannot mark payments paid, choose provider secrets, or set seller payout amounts.
- Stripe and PayPal webhooks are signature-verified and stored by provider event ID for idempotency.

## Operations pages

- `/admin/payments`: payment system overview.
- `/admin/payments/gateways`: provider registry and encrypted credential setup.
- `/admin/payments/configurations`: country/currency controls and commission settings.
- `/admin/payments/operations`: gross volume, fees, refunds, disputes, payouts, and failed events.
- `/admin/payments/transactions`: all payment orders and transaction detail.
- `/admin/payments/refunds`: refund records.
- `/admin/payments/disputes`: dispute tracking.
- `/admin/payments/payouts`: seller payout records.
- `/admin/payments/commissions`: seller gross, platform commission, refunds, and seller net.
- `/admin/payments/webhooks`: safe webhook status list without raw secret data.

## Limitations

- PayPal marketplace payouts are not implemented; PayPal checkout is captured server-side, and seller settlement may require manual operations.
- Direct Google Pay token processing is disabled. Google Pay is exposed only through supported hosted gateways such as Stripe Checkout when available.
- Provider dispute evidence upload is tracked manually for now.
