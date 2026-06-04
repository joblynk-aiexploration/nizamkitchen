# Deployment Pipeline

NizamKitchen production should not build Docker images on the EC2 host during normal releases. The production host is small and should spend its resources running the app, database, Redis, health checks, and migrations.

## Recommended Flow

1. CI or an operator builds the image outside production.
2. CI pushes the image to a registry such as GitHub Container Registry, Docker Hub, or AWS ECR.
3. The production server pulls the exact immutable image tag.
4. The production server runs `prisma migrate deploy`.
5. The production server restarts only the app service from the pulled image.
6. Health checks verify `/api/health` and the container health status.
7. If health fails, roll back to the previous image tag.

## Preferred Registry

Use GitHub Container Registry first because the code already lives on GitHub:

```text
ghcr.io/joblynk-aiexploration/nizamkitchen:<git-sha>
```

Use immutable tags based on the Git SHA. Avoid deploying mutable tags such as `latest` without also recording the source commit.

## Operator Command

From a clean local or CI checkout:

```bash
IMAGE=ghcr.io/joblynk-aiexploration/nizamkitchen:sha-$(git rev-parse --short HEAD) \
PROD_HOST=ubuntu@ec2-18-119-205-193.us-east-2.compute.amazonaws.com \
SSH_KEY="/path/to/key.pem" \
APP_URL=https://nk.friscodawah.org \
./scripts/ops/deploy-production.sh
```

The script builds a `linux/amd64` image by default, pushes it, then asks the server to pull and restart.

## Server Pull And Restart

On the production server, from the NizamKitchen app directory:

```bash
NIZAMKITCHEN_IMAGE=ghcr.io/joblynk-aiexploration/nizamkitchen:sha-abc123 \
APP_URL=https://nk.friscodawah.org \
./scripts/ops/pull-and-restart.sh
```

This script:

- refuses to run without `.env.production`
- pulls the image
- tags the current image as a rollback image
- runs migrations with `prisma migrate deploy`
- restarts the app using `docker compose up -d --no-build app`
- waits for container health
- verifies `/api/health`

## Rollback

If the deployment health check fails, restore the rollback image tag shown by the script:

```bash
docker tag nizamkitchen:production-rollback-YYYYMMDD-HHMMSS nizamkitchen:production
ENV_FILE=.env.production docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-build app
APP_URL=https://nk.friscodawah.org ./scripts/ops/health-check.sh
```

## Resource Health

Before deployments:

```bash
APP_URL=https://nk.friscodawah.org ./scripts/ops/server-health.sh
```

Recommended alert thresholds:

- disk warning: `/` above 85%
- disk critical: `/` above 95%
- swap warning: above 70%
- app container unhealthy
- database unreachable
- Redis unreachable
- deployment health check failed

## Docker Cleanup Policy

Safe routine cleanup:

```bash
docker container prune
docker image prune
docker builder prune
```

Do not run `docker system prune --volumes` on production. It can remove database or upload volumes.

Tagged rollback images consume disk. Keep only the current production image and one known-good rollback image unless a release incident requires more.

## Why This Matters

Building on a small production host can consume CPU, memory, swap, disk, and build cache for a long time. Pulling a prebuilt image makes deploys faster, more repeatable, and easier to roll back.
