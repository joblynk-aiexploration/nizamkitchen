# Payment Security

NizamKitchen's payment design keeps sensitive payment data out of the application.

## Card data policy

- No raw card number fields.
- No CVV/CVC fields.
- No custom card collection form.
- Hosted checkout or provider-controlled payment surfaces must be used.

## Credential storage

- Gateway secrets are encrypted with `ENCRYPTION_KEY`.
- Only `valuePreview` is stored for display.
- Decrypted secrets are used only server-side.
- Secrets must never be logged, exported, or returned to the browser.

## Trusted state

- Payment amounts are calculated server-side.
- Commission and seller amounts are calculated server-side.
- Webhooks are the trusted source for final payment state.
- Client redirects can show success/cancel messaging, but they do not mark payments paid.
- Webhook events are persisted by provider event ID for idempotency.

## Exports and logs

CSV exports include operational fields only. They intentionally exclude provider raw JSON, credentials, webhook payload bodies, and secrets.

Admin webhook pages show provider, event type, event ID, status, signature status, and timestamps only.

## Refunds and disputes

Refunds validate remaining paid amount before calling the provider. Full and partial refunds update `PaymentOrder` and linked module payment status. Disputes are created from provider webhook events and routed to admin review.
