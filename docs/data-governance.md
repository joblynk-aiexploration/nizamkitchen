# Data Governance

## Data Categories

- **Identity:** users, emails, phone numbers, OAuth accounts, sessions.
- **Tenant data:** organizations, memberships, household profiles, seller profiles.
- **Food planning:** recipes, meal plans, grocery lists, preferences.
- **Marketplace:** chef/catering/restaurant profiles, menus, orders, messages.
- **Financial:** subscriptions, payment orders, transactions, invoices, receipts, refunds, commissions.
- **Documents:** profile photos, cover photos, KYC/verification documents, support attachments.
- **Operational:** audit logs, system alerts, email logs, notification logs.
- **Legal/privacy:** acceptances, consents, privacy requests, suppressions.

## Access Principles

- Users access their own household/customer data.
- Sellers access only their own organization, menu, order, fulfillment, and verification data.
- Chef staff access only assigned/requested chef requests.
- Platform Owner can access global operational records.
- Country-scoped roles must be filtered by assigned countries.

## Retention Assumptions

- Financial/accounting records should be retained according to business/legal policy and should not be hard-deleted casually.
- Audit logs should be append-only and retained long enough for incident investigation.
- KYC documents require stricter access and retention controls than public profile media.
- Deleted users may require anonymization while preserving payment/accounting integrity.

## Privacy Request Workflow

1. User submits export/deletion/privacy request.
2. Platform verifies identity and request scope.
3. Export bundles include user-owned data but exclude other tenant/private data.
4. Deletion/anonymization preserves required financial, audit, and legal records.
5. Completion is logged and communicated through privacy/email workflows.

