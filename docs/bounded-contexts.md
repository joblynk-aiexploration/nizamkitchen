# Bounded Contexts

This document maps NizamKitchen modules into bounded contexts so the current modular monolith can scale without becoming a tangled application.

## Identity and Access

- **Purpose:** users, sessions, passwords, OAuth, account state, platform roles, and login auditability.
- **Primary models:** `User`, `Session`, `OAuthAccount`, `PasswordResetToken`, `AuditLog`.
- **Owner files:** `src/lib/session.ts`, `src/server/auth/*`, `src/app/api/auth/*`.
- **Public services/APIs:** login, logout, register, OAuth start/callback, password reset.
- **Tenant rules:** identity is global; active organization and country scope are resolved after authentication.
- **Security concerns:** session cookies, OAuth state, password hashing, inactive users, open redirects.
- **Technical debt:** centralize all auth error messages and provider status reporting.

## Tenancy and Organizations

- **Purpose:** organization membership, active workspace, country scope, household/seller ownership.
- **Primary models:** `Organization`, `Membership`, `Country`, `CountryAssignment`.
- **Owner files:** `src/server/admin/organizations.ts`, `src/app/api/organizations/*`.
- **Tenant rules:** organization data must be filtered by active membership unless platform role permits global scope.
- **Security concerns:** cross-tenant access, country-manager scope, ownership transfers.

## Platform Admin and RBAC

- **Purpose:** platform owner/admin operations, roles, permissions, policies, audit logs.
- **Primary models:** `User`, `Role`, `Permission`, `Policy`, `AuditLog`.
- **Owner files:** `src/app/(app)/admin/*`, `src/server/admin/*`, `src/lib/auth/*`.
- **Tenant rules:** platform owner has global access; scoped admin roles require explicit country/permission checks.
- **Security concerns:** privilege escalation, last-owner protection, secret visibility.

## Recipes and Grocery Planning

- **Purpose:** recipes, ingredients, unit conversion, meal planning, grocery list generation/export.
- **Primary models:** `Recipe`, `Ingredient`, `Unit`, `MealPlan`, `GroceryList`.
- **Owner files:** `src/server/recipes/*`, `src/server/grocery/*`, `src/server/meal-plans/*`.
- **Tenant rules:** global published recipes plus tenant-owned recipes; private recipes remain tenant-scoped.
- **Integration points:** grocery partners, PDF/export, recipe request flow.

## Marketplace

- **Purpose:** public discovery of chefs, caterers, restaurants, menus, reviews, and order entry points.
- **Primary models:** `ChefProfile`, `HomeCateringProfile`, `RestaurantProfile`, `Menu`, `MenuItem`, `Review`.
- **Owner files:** marketplace routes under `src/app/(app)/chefs`, `caterers`, `restaurants`; services under `src/server/home-catering`, `src/server/recipes`.
- **Tenant rules:** only approved/visible sellers should be public in production.
- **Security concerns:** private seller docs, fake reviews, unpublished menu data.

## Home Chef Requests

- **Purpose:** household request workflow for chef services, assignment, messaging, status changes.
- **Primary models:** `HomeChefRequest`, request messages/history, chef profile linkage.
- **Owner files:** `src/server/home-chef/*`, `src/app/(app)/home-chef/*`, `src/app/(app)/chef/requests/*`.
- **Tenant rules:** households see their own requests; chef staff see only assigned/requested requests; platform sees all.
- **Domain events:** request submitted, assigned, accepted, declined, message received, completed.

## Home Catering and Restaurants

- **Purpose:** seller profiles, menus, menu items, orders, fulfillment, promotions.
- **Primary models:** seller organization/profile models, `Menu`, `MenuItem`, `FoodOrder`.
- **Owner files:** `src/app/(app)/catering/*`, `src/app/(app)/restaurant/*`, `src/server/home-catering/*`.
- **Tenant rules:** sellers manage only their own organization and orders.
- **Security concerns:** verification status, document privacy, customer data minimization.

## Orders and Fulfillment

- **Purpose:** food orders, pickup/delivery, zones, time slots, status tracking.
- **Primary models:** `FoodOrder`, fulfillment settings, delivery zones/time slots.
- **Owner files:** `src/app/(app)/orders/*`, fulfillment admin/seller pages, payment services.
- **Domain events:** order submitted, accepted, declined, preparing, ready, completed, cancelled.
- **Security concerns:** seller/customer data scoping, no fake payment success.

## Payments and Billing

- **Purpose:** billing plans, subscriptions, checkout, transactions, refunds, payouts, gateway config.
- **Primary models:** `BillingPlan`, `Subscription`, `PaymentOrder`, `PaymentTransaction`, refund/payout models.
- **Owner files:** `src/server/payments/*`, `src/server/billing/*`, `src/app/(app)/billing/*`, `src/app/(app)/admin/payments/*`.
- **Tenant rules:** users see own billing; sellers see own payouts; platform sees all.
- **Security concerns:** no raw card data, encrypted gateway secrets, webhook idempotency.

## Accounting and Invoicing

- **Purpose:** invoices, receipts, commissions, settlement reports, exports.
- **Primary models:** `Invoice`, `Receipt`, `Commission`, settlement/export models.
- **Owner files:** `src/server/accounting/*`, `src/components/accounting/*`, admin/customer invoice routes.
- **Security concerns:** immutable records, PDF access control, retention requirements.

## Storage and Documents

- **Purpose:** profile photos, cover photos, documents, admin Dropbox, signed/private file access.
- **Primary models:** `StorageFile`, storage configuration/integration records.
- **Owner files:** `src/server/storage/*`, `src/app/api/storage/*`, `src/app/api/admin/dropbox/*`.
- **Tenant rules:** uploaded files must belong to requesting user/org or platform-admin scope.
- **Security concerns:** private S3 URLs, CSP, KYC privacy, MIME/size validation.

## Notifications and Email

- **Purpose:** in-app notifications, transactional email, templates, logs, preferences, suppressions.
- **Primary models:** `Notification`, `EmailTemplate`, `EmailLog`, `EmailPreference`, `EmailSuppression`.
- **Owner files:** `src/server/notifications/*`, `src/server/email/*`, `src/app/(app)/admin/emails/*`.
- **Domain events:** notification created, email queued/sent/failed/skipped.
- **Security concerns:** no secrets in templates/logs, respect preferences where safe.

## Legal and Privacy

- **Purpose:** legal documents, acceptances, consent, privacy requests, export/deletion workflows.
- **Primary models:** legal document/acceptance/consent/privacy request models.
- **Owner files:** `src/server/legal/*`, `src/server/privacy/*`, `src/app/(app)/privacy-center/*`.
- **Security concerns:** auditability, data retention, deletion limits for accounting/legal records.

## API Integrations

- **Purpose:** provider-specific OAuth, maps, email, storage, payments, analytics, KYC, custom APIs.
- **Primary models:** platform integration/configuration/credential models.
- **Owner files:** `src/server/config/platform-config-service.ts`, `src/lib/integrations/*`, `src/app/(app)/admin/apis/*`.
- **Security concerns:** encrypted secrets, masked previews, platform-owner-only secret management.

## Reports and Observability

- **Purpose:** operational reports, health checks, audit logs, alerts, integration status.
- **Primary models:** `AuditLog`, `SystemAlert`, email/payment/storage logs.
- **Owner files:** `src/server/admin/dashboard.ts`, `src/server/logging/*`, health routes.
- **Technical debt:** formal OpenTelemetry tracing and event outbox are future work.

