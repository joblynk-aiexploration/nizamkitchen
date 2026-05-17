# NizamKitchen SaaS Foundation

Initial enterprise-grade SaaS foundation for NizamKitchen. This phase intentionally focuses on platform infrastructure only and excludes recipe, grocery, chef marketplace, restaurant fallback, maps, YouTube, and ordering modules.

## Stack

- Next.js 16 App Router
- TypeScript with strict mode
- Tailwind CSS
- PostgreSQL + Prisma ORM
- Zod validation
- Custom email/password auth with HTTP-only session cookies
- Multi-tenant and country-aware access controls

## What is included

- Custom register, login, logout, and current-session helpers
- Tenant-safe organization scoping utilities
- Platform role and organization role guards
- Country registry, country assignments, and country configs
- Audit logs, feature flags, billing placeholders, API key placeholders, storage file placeholders, email log placeholders, and system settings
- Public, protected, and platform admin route structure
- Health endpoints at `/api/health` and `/api/health/db`
- Seed data for demo users, organizations, countries, and flags
- Docker assets for PostgreSQL, Redis, MinIO, and Mailpit

## Quick start

1. Copy `.env.example` to `.env`.
2. Start local dependencies with `npm run docker:up`.
3. Install dependencies with `npm install`.
4. Generate Prisma client with `npm run db:generate`.
5. Create the database schema with `npm run db:migrate`.
6. Seed demo data with `npm run db:seed`.
7. Run the app with `npm run dev`.

## Demo credentials

- `owner@nizamkitchen.dev` / `Password123!`
- `admin@nizamkitchen.dev` / `Password123!`
- `country@nizamkitchen.dev` / `Password123!`
- `household@nizamkitchen.dev` / `Password123!`
- `chef@nizamkitchen.dev` / `Password123!`
- `restaurant@nizamkitchen.dev` / `Password123!`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:deploy`
- `npm run db:seed`
- `npm run docker:up`
- `npm run docker:down`

## Architecture notes

- Every tenant-owned model includes `organizationId`.
- Country-aware models include `countryCode`.
- All API handlers validate input with Zod.
- Auth and permission checks are enforced server-side.
- Audit events are recorded for important actions and denied access attempts.
- Future product modules should use the helpers in `src/lib/tenant.ts` and `src/lib/permissions.ts`.
