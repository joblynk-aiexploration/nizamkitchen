#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-85}"
DISK_CRITICAL_PERCENT="${DISK_CRITICAL_PERCENT:-95}"
SWAP_WARN_PERCENT="${SWAP_WARN_PERCENT:-70}"

usage() {
  cat <<'EOF'
Usage:
  APP_URL=https://nk.friscodawah.org ./scripts/ops/server-health.sh

Optional:
  COMPOSE_FILE=docker-compose.prod.yml
  ENV_FILE=.env.production
  DISK_WARN_PERCENT=85
  DISK_CRITICAL_PERCENT=95
  SWAP_WARN_PERCENT=70

Reports disk, memory, Docker, compose, and app health without printing secrets.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

command -v docker >/dev/null 2>&1 || {
  echo "docker is required on this host." >&2
  exit 1
}

root_use="$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')"
apps_use="$(df -P /apps/data 2>/dev/null | awk 'NR==2 {gsub("%", "", $5); print $5}' || true)"
swap_use="$(free | awk '/Swap:/ { if ($2 == 0) print 0; else printf "%.0f", ($3 / $2) * 100 }')"

echo "== filesystem =="
df -h / /apps/data 2>/dev/null || df -h /

if [ "$root_use" -ge "$DISK_CRITICAL_PERCENT" ]; then
  echo "CRITICAL: / disk usage is ${root_use}%."
elif [ "$root_use" -ge "$DISK_WARN_PERCENT" ]; then
  echo "WARNING: / disk usage is ${root_use}%."
else
  echo "OK: / disk usage is ${root_use}%."
fi

if [ -n "$apps_use" ]; then
  echo "OK: /apps/data disk usage is ${apps_use}%."
fi

echo
echo "== memory =="
free -h
if [ "$swap_use" -ge "$SWAP_WARN_PERCENT" ]; then
  echo "WARNING: swap usage is ${swap_use}%."
else
  echo "OK: swap usage is ${swap_use}%."
fi

echo
echo "== docker disk =="
docker system df

echo
echo "== compose services =="
if [ -f "$ENV_FILE" ]; then
  ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
else
  echo "WARNING: $ENV_FILE is missing; compose service status skipped."
fi

echo
echo "== app health =="
APP_URL="$APP_URL" ./scripts/ops/health-check.sh
