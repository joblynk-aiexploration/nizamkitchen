# Deployment Guide

## Single VPS path now

1. Provision a Linux host with Docker Engine and Docker Compose.
2. Copy the repository or deploy a built image plus `docker-compose.prod.example.yml`.
3. Create `.env.production` from `.env.example` and replace all placeholder values.
4. Run `docker compose -f docker-compose.prod.example.yml up -d`.
5. Run production migrations with `docker compose -f docker-compose.prod.example.yml exec app npm run db:deploy`.
6. Verify `/api/health`, `/api/health/db`, `/api/health/redis`, and `/api/health/storage`.

## ECS/Fargate path later

- Reuse the same Docker image.
- Move Postgres to RDS.
- Move Redis to ElastiCache or an equivalent managed service.
- Move object storage to S3 or another S3-compatible provider.
- Run `prisma migrate deploy` as a one-off task before rolling the app service.

## Deployment guardrails

- Never commit real secrets.
- Rotate SMTP, storage, and session-related secrets before first production deploy.
- Keep database migrations in the release pipeline before traffic shifts.
