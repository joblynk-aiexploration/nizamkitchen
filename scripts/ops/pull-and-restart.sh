#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
NIZAMKITCHEN_IMAGE="${NIZAMKITCHEN_IMAGE:-}"
KEEP_PREVIOUS_TAG="${KEEP_PREVIOUS_TAG:-true}"

usage() {
  cat <<'EOF'
Usage:
  NIZAMKITCHEN_IMAGE=ghcr.io/OWNER/nizamkitchen:sha-... APP_URL=https://nk.friscodawah.org ./scripts/ops/pull-and-restart.sh

Optional:
  COMPOSE_FILE=docker-compose.prod.yml
  ENV_FILE=.env.production
  KEEP_PREVIOUS_TAG=true

Runs on the production server. Pulls an already-built image, runs Prisma migrate deploy,
restarts the app, and verifies health. Does not build on the production host.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ -z "$NIZAMKITCHEN_IMAGE" ]; then
  echo "Set NIZAMKITCHEN_IMAGE to a registry image tag before deploying." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Create it on the server; never commit production env files." >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  echo "docker is required on this host." >&2
  exit 1
}

previous_image_id="$(docker image inspect nizamkitchen:production --format '{{.Id}}' 2>/dev/null || true)"
timestamp="$(date +%Y%m%d-%H%M%S)"

echo "Pulling $NIZAMKITCHEN_IMAGE..."
docker pull "$NIZAMKITCHEN_IMAGE"

if [ -n "$previous_image_id" ] && [ "$KEEP_PREVIOUS_TAG" = "true" ]; then
  docker tag "$previous_image_id" "nizamkitchen:production-rollback-$timestamp" || true
  echo "Rollback image tag created: nizamkitchen:production-rollback-$timestamp"
fi

docker tag "$NIZAMKITCHEN_IMAGE" nizamkitchen:production

echo "Starting dependencies..."
ENV_FILE="$ENV_FILE" NIZAMKITCHEN_IMAGE=nizamkitchen:production docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis

echo "Running migrations..."
ENV_FILE="$ENV_FILE" NIZAMKITCHEN_IMAGE=nizamkitchen:production docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrate

echo "Restarting app from prebuilt image..."
ENV_FILE="$ENV_FILE" NIZAMKITCHEN_IMAGE=nizamkitchen:production docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build app

echo "Waiting for app health..."
attempt=1
while [ "$attempt" -le 30 ]; do
  status="$(docker inspect -f '{{.State.Health.Status}}' nizamkitchen-app-1 2>/dev/null || echo missing)"
  echo "health=$status"
  if [ "$status" = "healthy" ]; then
    APP_URL="$APP_URL" ./scripts/ops/health-check.sh
    echo "Deployment completed."
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 5
done

echo "Deployment health check failed. Review logs and roll back if needed:" >&2
echo "  docker tag nizamkitchen:production-rollback-$timestamp nizamkitchen:production" >&2
echo "  ENV_FILE=$ENV_FILE docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d --no-build app" >&2
exit 1
