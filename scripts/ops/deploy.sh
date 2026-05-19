#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
APP_URL="${APP_URL:-}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Do not commit it; create it directly on the server." >&2
  exit 1
fi

echo "Building production image..."
ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build app migrate

echo "Starting database and Redis..."
ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis

echo "Running database migrations..."
COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" ./scripts/ops/run-migrations.sh

echo "Starting application..."
ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d app

echo "Checking application health..."
if [ -n "$APP_URL" ]; then
  APP_URL="$APP_URL" ./scripts/ops/health-check.sh
else
  ./scripts/ops/health-check.sh
fi

echo "Deployment completed."
