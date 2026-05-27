# Seller Verification

NizamKitchen supports configurable seller verification for chef businesses, home catering sellers, and restaurant partners.

## Verification Areas

- Identity/KYC
- Food safety certificates
- Local permits or licenses
- Kitchen safety review
- Background check consent and status
- Payout readiness
- Admin approval and policy gating

## Privacy Rules

- No raw SSNs are stored directly.
- Private documents are stored in private object storage.
- Public profiles only show safe verification badges.
- Background checks require consent before request.
- Household users must never see seller verification documents.

## Seller Pages

- `/chef/verification`
- `/catering/verification`
- `/restaurant/verification`

## Admin Pages

- `/admin/verifications`
- `/admin/verifications/[id]`
- `/admin/verifications/requirements`
- `/admin/verifications/background-checks`
- `/admin/verifications/kitchen-reviews`
- `/admin/kyc`
- `/admin/kyc/providers`
- `/admin/kyc/background-checks`
- `/admin/kyc/identity-verifications`

## Policy Gating

Verification policy can control whether sellers may:
- publish public profiles
- publish menu items
- accept orders
- receive payouts
- use live checkout

Temporary admin overrides can be granted, but they are logged and expire if configured.

## What Is Still Placeholder

- Some KYC and background provider integrations remain manual or placeholder-based until configured.
- Country- and region-specific legal/compliance interpretation still requires operator judgment and legal review.
- Trial or taste-test workflows may still involve manual scheduling and review.

## Launch Checklist

- Review active verification policies by seller type and country.
- Confirm required documents and consent flows are enabled.
- Confirm private verification files use signed URLs only.
- Confirm public badges do not expose sensitive details.
