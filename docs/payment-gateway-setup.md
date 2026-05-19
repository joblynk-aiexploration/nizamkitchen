# Payment Gateway Setup

Only platform owners and platform admins should configure payment gateways.

## Required environment

- `ENCRYPTION_KEY`: required before saving gateway credentials.
- `APP_URL`: required so checkout return/cancel URLs point to the deployed app.
- Provider keys should be entered in the admin UI, not committed to Git.

## Gateway setup flow

1. Open `/admin/payments/gateways`.
2. Create a gateway with provider, sandbox/live environment, countries, currencies, and priority.
3. Save credentials on the gateway detail page.
4. Configure `/admin/payments/configurations` for each country/currency.
5. Enable feature flags such as `payments`, `live_checkout`, `stripe_payments`, or `paypal_payments`.
6. Run a sandbox checkout before switching the gateway to live.

## Country and currency controls

Gateways are filtered by:

- gateway `status = active`
- gateway country or global scope
- supported country list
- supported currency list
- payment configuration allow flags
- seller payout readiness when marketplace live payment requires a connected account

If no eligible gateway exists, checkout should show a clean unavailable message.

## Secrets

Do not store secrets in `.env.local`, README files, screenshots, or docs. Secrets saved through the admin UI are encrypted and only masked previews are displayed.
