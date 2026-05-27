# Compliance Readiness

This document is not legal advice. It identifies engineering controls that support future compliance reviews.

## Current Supporting Controls

- Role-scoped access through server-side RBAC.
- Tenant scoping for household, seller, and admin workflows.
- Audit logs for important admin and domain changes.
- Encrypted/masked integration secrets in platform configuration.
- Private storage and signed file URLs for sensitive documents.
- Email preferences and suppressions.
- Legal document and acceptance tracking.
- Privacy center workflows for data access/deletion requests.

## Gaps To Address Before Regulated Enterprise Launch

- Formal data retention policy approved by counsel.
- Formal incident response runbooks with owner escalation.
- Complete OpenTelemetry/log correlation story.
- Event outbox and retry processor for reliable async workflows.
- Documented disaster recovery RPO/RTO and restore drills.
- Staging environment with production-like integrations.
- Periodic access review for Platform Owner/Admin accounts.

## Payment and KYC Notes

- Do not store raw card data or CVV.
- Keep payment processing in Stripe/PayPal or other PCI-compliant gateways.
- KYC/background-check provider data should be minimized and access-controlled.
- Refund/accounting records should remain auditable.

