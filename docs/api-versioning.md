# API Versioning

## Current State

NizamKitchen API routes are currently product-internal Next.js route handlers under `/api/*`. They support auth, OAuth, webhooks, storage, health checks, payments, exports, and admin operations.

## Future Public API Strategy

External/public APIs should be introduced under `/api/v1/*` only after contracts stabilize. Existing internal app routes can remain unversioned while they are browser-coupled.

## Compatibility Rules

- Do not remove response fields from versioned APIs.
- Additive fields are allowed.
- Breaking changes require a new version.
- Mutations should support idempotency keys where duplicate client submissions are realistic.
- Errors should use a stable shape: `{ code, message, requestId, details? }`.
- Webhooks should validate signatures and store provider event ids.

## Auth and Tenancy Conventions

- Browser app routes use session cookies.
- Future public APIs should use scoped tokens.
- Every route must resolve tenant/country/user access server-side.
- Platform-owner-only routes must never rely on client-visible controls.

## Webhook Conventions

- Verify signatures before parsing business payloads.
- Log provider event id, type, received time, processing status, and error message.
- Acknowledge only after safe persistence or deliberate deferral.
- Keep webhook handlers idempotent.

