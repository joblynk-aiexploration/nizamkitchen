# Known Limitations

This document tracks intentional beta-stage limitations and placeholders. These are not hidden features and should be reviewed before production launch.

## Marketplace and ordering

- Food orders are request workflows first. Some seller flows still rely on manual confirmation, especially when payout onboarding or country-specific policies block live checkout.
- Delivery tracking is not implemented.
- Restaurant partner experiences are functional for profile, menu, and order-request workflows, but they are not full restaurant POS replacements.

## Payments

- Stripe and PayPal flows exist, but not every future gateway is live. Adapter shells for additional providers are placeholders only.
- Direct Google Pay token processing is intentionally disabled. Google Pay may appear only through supported hosted gateway experiences.
- Some dispute and payout operations still require manual operator review.

## Storage and uploads

- Production is designed for S3-compatible object storage. Local development uses MinIO-style placeholders.
- Broken or missing files should degrade safely to placeholders, but operational recovery of orphaned files is still an admin workflow.

## Seller verification and KYC

- Verification requirements are configurable, but some provider integrations remain manual or placeholder-based until real provider credentials are configured.
- Background checks require consent and provider configuration. Provider-specific report automation is not fully live by default.
- Public badges intentionally expose only safe verification summaries, never raw documents or report contents.

## Optional integrations

- Google Maps Platform, YouTube discovery, SMTP, Stripe, PayPal, storage, KYC providers, and error tracking must all fail gracefully when not configured.
- Missing integrations should show setup or disabled states rather than crash, but the related business workflow may remain unavailable until configured.

## Legal and privacy

- Legal document templates are placeholders and must be replaced with counsel-reviewed final text before a real launch.
- Privacy export, deletion, and anonymization controls are operational workflows, not fully automated self-service deletion.

## Demo and seed data

- Demo accounts and sample marketplace data are for local/CI environments only.
- Demo payment records, if present in development, must remain clearly marked as demo/manual data and must never be treated as real settlement data.
- Seed data should remain focused on real Hyderabadi recipes and realistic seller/menu examples.

## Legacy Video Analysis

Legacy video-analysis automation has been intentionally removed and must not be reintroduced.
