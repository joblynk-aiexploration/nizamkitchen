# Production Deployment

This guide covers a Docker-based VPS or EC2-style deployment for NizamKitchen.

## Production Stack

- Next.js app container
- PostgreSQL 16
- Redis
- S3-compatible object storage
- nginx reverse proxy
- HTTPS via Cloudflare or certbot

## Required Environment Variables

```bash
NODE_ENV=production
APP_URL=https://app.example.com
DATABASE_URL="<postgres connection string>"
# set the session secret in the ignored production env file
```

For the current NizamKitchen production domain, `APP_URL` must be:

```bash
APP_URL="<https://nk.friscodawah.org>"
```

Google OAuth must use this exact production redirect URI in Google Cloud Console:

```text
https://nk.friscodawah.org/api/auth/oauth/google/callback
```

## Common Optional Environment Variables

Configure optional integration values in the ignored production env file or a managed secret store. Do not paste real values into Git-tracked files.

| Setting | Purpose |
| --- | --- |
| `REDIS_URL` | Redis connection string. |
| `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION` | S3-compatible storage location. |
| `OBJECT_STORAGE_ACCESS_KEY` and the matching storage secret value | S3-compatible storage credentials. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and the matching SMTP password value | Outbound email provider. |
| `EMAIL_FROM` | Default sender email address. |
| Google Maps, Places, and Geocoding key settings | Google location services. |
| `YOUTUBE_DISCOVERY_ENABLED` and the YouTube server key setting | YouTube discovery and curation. |
| Encryption key setting | Field-level credential encryption. |
| `ERROR_TRACKING_DSN`, `ERROR_TRACKING_ENABLED` | Error tracking provider integration. |
| `DEPLOYMENT_ENVIRONMENT` | Deployment environment label. |

Do not commit production env files. Keep them only on the server or in a managed secret store.

## Deployment Steps

1. Install Docker Engine and Docker Compose plugin.
2. Configure a container registry such as GitHub Container Registry, Docker Hub, or AWS ECR.
3. Create `.env.production` with the production values above.
4. Build the image outside production and push an immutable tag.
5. Pull the image on the production server.
6. Run production migrations.
7. Start the app container.
8. Verify `/api/health` and the admin system status pages.

The EC2 host should not build images during normal deployments. Building on the server can exhaust disk, memory, and swap.

## Commands

Deploy:

```bash
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml ./scripts/ops/deploy.sh
```

Preferred registry-based deployment:

```bash
IMAGE=ghcr.io/joblynk-aiexploration/nizamkitchen:sha-$(git rev-parse --short HEAD) \
PROD_HOST=ubuntu@ec2-18-119-205-193.us-east-2.compute.amazonaws.com \
SSH_KEY="/path/to/key.pem" \
APP_URL=https://nk.friscodawah.org \
./scripts/ops/deploy-production.sh
```

Pull and restart from the server:

```bash
NIZAMKITCHEN_IMAGE=ghcr.io/joblynk-aiexploration/nizamkitchen:sha-abc123 \
APP_URL=https://nk.friscodawah.org \
./scripts/ops/pull-and-restart.sh
```

Run migrations only:

```bash
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml ./scripts/ops/run-migrations.sh
```

Health check:

```bash
APP_URL=https://app.example.com ./scripts/ops/health-check.sh
```

Server resource check:

```bash
APP_URL=https://nk.friscodawah.org ./scripts/ops/server-health.sh
```

See [deployment-pipeline.md](./deployment-pipeline.md) for registry, rollback, and cleanup guidance.

## Prisma and Seed Strategy

- Use `npx prisma migrate deploy` in production.
- Do not run `prisma migrate dev` in production.
- Do not run destructive or demo-oriented seed workflows in production.
- If you need initial production data, create a reviewed production-safe seed path first.

## Health Endpoints

Available operational endpoints:
- `/api/health`
- `/api/health/db`
- `/api/health/storage`
- `/api/health/payments`
- `/api/health/integrations`

These endpoints must return safe JSON only and must not expose connection strings, secrets, raw stack traces, or provider credentials.

## Production Safety Notes

- Secure cookies require HTTPS in production.
- Payment, storage, and KYC credentials must remain server-side only.
- Optional integrations must fail gracefully when not configured.
- Demo login shortcuts, uploaded files, and local-only env files must never be committed.
- Legacy video-analysis automation is not part of the production platform.

## Manual Launch Checklist

- Confirm DNS, nginx, and HTTPS are configured.
- Confirm PostgreSQL backups are working before migrations.
- Confirm S3/object storage is reachable and tested.
- Confirm SMTP, Stripe, PayPal, and KYC providers are either configured or intentionally disabled.
- Run lint, type-check, tests, build, and E2E before cutting over traffic.
