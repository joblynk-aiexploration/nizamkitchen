# NizamKitchen

NizamKitchen helps Hyderabadi households plan meals, generate groceries, cook with real recipes and videos, hire home chefs, browse home catering sellers, and order from restaurant partners.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | Custom email/password + HTTP-only session cookies |
| Storage | S3-compatible object storage with local MinIO fallback |
| Payments | Provider-agnostic gateway layer with Stripe and PayPal support |
| Email | SMTP with graceful placeholder mode |
| Testing | Vitest + Playwright |
| Local infra | Docker Compose for PostgreSQL, Redis, MinIO, Mailpit |

## Local Setup

Prerequisites:
- Node.js 22+
- Docker Desktop or another Docker daemon for local services

Commands:

```bash
npm install
cp .env.example .env
npm run docker:up
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open `http://localhost:3000`.

Local service ports:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `localhost:9000`
- MinIO console: `localhost:9001`
- Mailpit SMTP: `localhost:1025`
- Mailpit UI: `localhost:8025`

## Required Environment Variables

These are required for a real app runtime:

```bash
DATABASE_URL=
SESSION_SECRET=
APP_URL=
NODE_ENV=
```

Additional commonly used variables:

```bash
REDIS_URL=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
GOOGLE_MAPS_BROWSER_API_KEY=
GOOGLE_MAPS_SERVER_API_KEY=
GOOGLE_PLACES_SERVER_API_KEY=
GOOGLE_GEOCODING_API_KEY=
YOUTUBE_DATA_API_KEY=
YOUTUBE_DISCOVERY_ENABLED=
ENCRYPTION_KEY=
ERROR_TRACKING_DSN=
ERROR_TRACKING_ENABLED=
DEPLOYMENT_ENVIRONMENT=
```

Use [`.env.example`](/Users/rm/projects/nizamkitchen/.env.example) as the source of truth for local placeholders.

## Local Demo Accounts

Local seed data creates the current five role-based demo accounts:

| Role | Purpose |
| --- | --- |
| Platform owner | Full platform control |
| Household | Customer and family workflows |
| Chef staff | Assigned home chef requests only |
| Home catering staff | Own catering profile, menu, and orders |
| Restaurant owner | Own restaurant profile, menu, and orders |

Use your ignored local environment or the protected local login panel for demo credentials. Do not document, commit, or reuse local demo passwords in production.

## Quality Checks

```bash
npx prisma generate
npx prisma validate
npm run lint
npm run type-check
npm run test
npm run build
npm run test:e2e
```

Notes:
- `npm run test` currently passes with the full Vitest suite.
- `npm run test:e2e` requires PostgreSQL to be running and seeded.

## Production Setup

Use the dedicated deployment guides:
- [docs/production-deployment.md](/Users/rm/projects/nizamkitchen/docs/production-deployment.md)
- [docs/payments.md](/Users/rm/projects/nizamkitchen/docs/payments.md)
- [docs/storage.md](/Users/rm/projects/nizamkitchen/docs/storage.md)
- [docs/seller-verification.md](/Users/rm/projects/nizamkitchen/docs/seller-verification.md)
- [docs/operations.md](/Users/rm/projects/nizamkitchen/docs/operations.md)
- [docs/known-limitations.md](/Users/rm/projects/nizamkitchen/docs/known-limitations.md)

## Security Notes

- Never commit `.env.local`, `.env.production`, uploaded files, provider secrets, or encryption keys.
- Session cookies are HTTP-only and should only be used behind HTTPS in production.
- Payment, storage, and KYC credentials are server-side only and must never be exposed in browser config.
- Legacy video-analysis automation has been intentionally removed and is not part of this codebase.

## Launch Checklist

- Confirm PostgreSQL, Redis, SMTP, and object storage are reachable.
- Set all production secrets outside Git.
- Run `npx prisma generate` and `npx prisma validate`.
- Run `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`, and `npm run test:e2e`.
- Seed only local/demo environments; do not run demo seed destructively in production.
- Review feature flags, payment gateway status, storage status, and seller verification policy before launch.
