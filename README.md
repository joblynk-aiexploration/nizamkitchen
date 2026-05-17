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
- Health endpoints at `/api/health`, `/api/health/db`, `/api/health/redis`, and `/api/health/storage`
- Seed data for demo users, organizations, countries, and flags
- Docker assets for PostgreSQL, Redis, MinIO, and Mailpit
- CI validation workflow and deployment documentation

## Quick start

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start the full local stack with `npm run docker:up`.
4. Create the database schema with `npm run db:migrate`.
5. Seed demo data with `npm run db:seed`.
6. Open `http://localhost:3000`.

## Environment variables

- Core runtime values are documented in `.env.example`.
- Infrastructure placeholders include PostgreSQL, Redis, object storage, SMTP, logging, and observability settings.
- Full reference: [Environment Variables](docs/environment-variables.md)

## Database setup

1. Confirm `DATABASE_URL` points to PostgreSQL.
2. Run `npm run db:generate`.
3. Run `npm run db:migrate`.
4. Run `npm run db:seed`.
5. Use `npm run db:deploy` for production releases only.

## Docker setup

- Local stack: `npm run docker:up`
- Local shutdown: `npm run docker:down`
- Local services include the app, PostgreSQL, Redis, MinIO, and Mailpit.
- Production example stack: `docker-compose.prod.example.yml`

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
- `npm run db:status`
- `npm run db:seed`
- `npm run docker:up`
- `npm run docker:down`

## Deployment docs

- [Infrastructure](docs/infrastructure.md)
- [Deployment](docs/deployment.md)
- [Environment Variables](docs/environment-variables.md)
- [Database Migrations](docs/database-migrations.md)
- [Backup And Restore](docs/backup-restore.md)
- [Security Notes](docs/security.md)

## Security notes

- Tenant isolation is enforced server-side.
- Platform admin access is separated from organization access.
- Sensitive denied-access events are audit logged.
- Session cookies are HTTP-only and secure in production.

## Deployment notes

- The current deployment target is flexible enough for a single VPS now and AWS ECS/Fargate later.
- Production database migrations must use `prisma migrate deploy`.
- Do not commit secrets; keep production credentials in environment-specific secret stores.

## Architecture notes

- Every tenant-owned model includes `organizationId`.
- Country-aware models include `countryCode`.
- All API handlers validate input with Zod.
- Auth and permission checks are enforced server-side.
- Audit events are recorded for important actions and denied access attempts.
- Future product modules should use the helpers in `src/lib/tenant.ts` and `src/lib/permissions.ts`.
