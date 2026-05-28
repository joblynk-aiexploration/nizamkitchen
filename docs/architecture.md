# NizamKitchen Architecture

NizamKitchen is a modular-monolith SaaS application built with Next.js App Router, Prisma, PostgreSQL, Redis, object storage, and provider-backed integrations. The production target remains a modular monolith because the product is still changing quickly and strong in-process consistency is more valuable than premature service boundaries. The codebase should, however, keep bounded contexts explicit so payments, accounting, storage, identity, marketplace, notifications, and public content can later be extracted without rewriting business rules.

## Architectural Style

- **Domain-driven modular monolith:** domain services live under `src/server/*`; route handlers and server components orchestrate but should not own complex business rules.
- **Clean architecture direction:** UI and routes depend inward on services, validation, and persistence adapters. Domain services should not import React components.
- **Hexagonal integration boundary:** provider-specific code belongs under integration-specific services such as `src/server/payments/providers/*`, `src/server/storage/*`, `src/server/email/providers/*`, and `src/server/config/*`.
- **Security-first multi-tenancy:** every server action, route handler, and service mutation must establish authenticated user, role, tenant, and country scope before data access.
- **Event-ready operations:** audit logs, notifications, email logs, payment webhooks, and system alerts are the current operational event trail. A formal outbox is recommended before high-volume async workflows.

## Runtime Boundaries

- **Public website:** `src/app/(public)` renders marketing, legal, auth, help, and marketplace entry pages.
- **Authenticated app:** `src/app/(app)` renders role-specific household, chef, catering, restaurant, billing, and admin workspaces.
- **API routes:** `src/app/api` owns browser/server integration points, webhooks, health checks, storage URLs, auth callbacks, and export/PDF endpoints.
- **Domain services:** `src/server` owns business logic, provider access, audit events, payments, billing, accounting, storage, localization, support, notifications, and marketplace operations.
- **Validation:** `src/lib/validation` owns input schemas and user-facing validation contracts.
- **Persistence:** Prisma models and migrations are the authoritative relational data contract.

## Production Principles

- Prefer server components and server actions for tenant-scoped workflows.
- Use provider registries and adapters instead of one-off integration code.
- Keep secrets in the Platform Configuration Vault or environment variables, never in client bundles.
- Treat optional integrations as disabled states, not application errors.
- Generate audit logs for identity, access, billing, storage, verification, and admin mutations.
- Keep payment/accounting records append-safe. Do not delete ledger records to satisfy UI cleanup.
- Use pagination for every unbounded list.
- Do not expose internal error details to end users.

## Release Gate

Before production release, the following must pass:

- `npx prisma generate`
- `npx prisma validate`
- `npx prisma migrate dev` or production `prisma migrate deploy`
- `npx prisma db seed` for local/dev validation
- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`
- Docker build and runtime smoke checks when Docker is the deployment path

