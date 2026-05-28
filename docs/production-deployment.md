# Production Deployment

This guide prepares NizamKitchen for a Docker-based VPS or EC2-style deployment. It intentionally keeps the target flexible: a single server today, a managed database or container orchestrator later.

## Stack

- Next.js app running from the production Docker image.
- PostgreSQL 16 with a persistent Docker volume or managed PostgreSQL.
- Redis for cache/queue placeholders.
- Persistent `app_uploads` volume for private upload/storage placeholders.
- nginx as the public reverse proxy.
- HTTPS through Cloudflare proxy mode or certbot/Let's Encrypt on the server.

## Required Environment Variables

Create `.env.production` directly on the server. Do not commit it.

```bash
NODE_ENV=production
DEPLOYMENT_ENVIRONMENT=production
APP_URL=https://app.example.com
DATABASE_URL=postgresql://nizamkitchen:REPLACE_ME@postgres:5432/nizamkitchen?schema=public
POSTGRES_DB=nizamkitchen
POSTGRES_USER=nizamkitchen
POSTGRES_PASSWORD=REPLACE_ME_WITH_A_LONG_RANDOM_PASSWORD
SESSION_SECRET=REPLACE_ME_WITH_32_PLUS_RANDOM_CHARACTERS
```

`DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, and `NODE_ENV=production` are required for a real production runtime. `SESSION_SECRET` must be at least 32 characters.

## Optional Environment Variables

```bash
REDIS_URL=redis://redis:6379
MAPTILER_API_KEY=
NEXT_PUBLIC_MAPTILER_API_KEY=
MAPTILER_RESTAURANT_DISCOVERY_ENABLED=false
YOUTUBE_DATA_API_KEY=
YOUTUBE_DISCOVERY_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@example.com
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Missing optional keys must show setup/disabled states rather than crashing the app. Server-only keys such as `MAPTILER_API_KEY`, `YOUTUBE_DATA_API_KEY`, SMTP credentials, and Stripe placeholders must never be exposed to browser bundles.

## First-Time Server Setup

1. Install Docker Engine and Docker Compose plugin.
2. Clone the repository on the server.
3. Create `.env.production` from the variables above.
4. Point DNS at the server.
5. Configure nginx and HTTPS before sending real users to the app.
6. Run `./scripts/ops/deploy.sh`.

The deploy script builds the image, starts PostgreSQL/Redis, runs `prisma migrate deploy`, starts the app, and calls `/api/health`.

## Deployment Commands

Build and deploy:

```bash
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml ./scripts/ops/deploy.sh
```

Run migrations only:

```bash
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml ./scripts/ops/run-migrations.sh
```

Check health:

```bash
APP_URL=https://app.example.com ./scripts/ops/health-check.sh
```

Manual compose commands:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

## Prisma Migrations

Production migrations must use:

```bash
npm run db:deploy
```

In Docker production, use the `migrate` service or `scripts/ops/run-migrations.sh`. Do not run `prisma migrate dev` in production.

Before applying migrations:

- Take a database backup.
- Confirm the app image was built from the intended Git commit.
- Review migration SQL if the migration is risky.
- Run migrations before routing traffic to the new app container.

Rollback plan:

- Prefer forward-fix migrations for schema changes.
- If rollback is unavoidable, stop app traffic, restore the verified backup, redeploy the previous image, and run health checks.

## Seed Strategy

Do not run destructive demo seed scripts automatically in production.

Recommended approach:

- Local development can use `npm run db:seed`.
- Production should start with migrations only.
- If an initial production owner or country catalog is needed, create a separate reviewed production-safe seed script before launch.
- Always back up before any production data import.

## Health Check

`GET /api/health` returns safe JSON only:

- app identity and environment label
- database reachability
- Prisma migration table reachability
- Prisma client health label
- uptime and app version
- observability placeholder snapshot
- timestamp

It does not return secrets, connection strings, API keys, stack traces, or user data. If the database or migration table is unreachable, it returns HTTP `503`.

Additional endpoints remain available for operators:

- `/api/health/db`
- `/api/health/redis`
- `/api/health/storage`

## nginx Reverse Proxy

Example nginx server block:

```nginx
server {
  listen 80;
  server_name app.example.com;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Use Cloudflare HTTPS in front of nginx or install certbot and redirect port 80 to 443.

## HTTPS Options

Cloudflare:

- Put the domain behind Cloudflare.
- Use Full or Full Strict SSL mode.
- Keep origin firewall rules tight.

certbot:

```bash
sudo certbot --nginx -d app.example.com
sudo certbot renew --dry-run
```

## Backups

See `docs/production-backups.md`.

Short version:

- Back up PostgreSQL before every production migration.
- Store backups outside Git.
- Encrypt and restrict access to backups.
- Test restores on a non-production database.

## Security Checklist

- `NODE_ENV=production` is set.
- `SESSION_SECRET` is strong and not committed.
- Secure cookies are active over HTTPS.
- nginx or Cloudflare sits in front of the Node process.
- `.env.production` exists only on the server.
- Demo login shortcuts are not present in committed code.
- Server-only API keys are not prefixed with `NEXT_PUBLIC_`.
- Optional MapTiler/YouTube/SMTP/Stripe keys can be missing without crashing.
- `/api/health` exposes no secrets.

## What Remains Manual

- Provisioning the VPS/EC2 host.
- Creating `.env.production`.
- DNS setup.
- Cloudflare/certbot HTTPS setup.
- Registry push/pull credentials if using GHCR/ECR.
- Production-safe initial admin creation if the demo seed is not acceptable.
- Backup scheduling in cron or the cloud provider.
