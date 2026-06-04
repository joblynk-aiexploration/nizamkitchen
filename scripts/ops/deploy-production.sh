#!/usr/bin/env sh
set -eu

IMAGE="${IMAGE:-}"
PLATFORM="${PLATFORM:-linux/amd64}"
PROD_HOST="${PROD_HOST:-}"
PROD_PATH="${PROD_PATH:-/apps/data/Nizam Kitchen}"
SSH_KEY="${SSH_KEY:-}"
APP_URL="${APP_URL:-https://nk.friscodawah.org}"

usage() {
  cat <<'EOF'
Usage:
  IMAGE=ghcr.io/OWNER/nizamkitchen:sha-... \
  PROD_HOST=ubuntu@example.com \
  SSH_KEY=/path/to/key.pem \
  ./scripts/ops/deploy-production.sh

Optional:
  PLATFORM=linux/amd64
  PROD_PATH="/apps/data/Nizam Kitchen"
  APP_URL=https://nk.friscodawah.org

Builds outside production, pushes to a registry, then asks the production server
to pull, migrate, restart, and health-check. No secrets are stored in this script.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ -z "$IMAGE" ]; then
  echo "Set IMAGE to a registry tag, for example ghcr.io/OWNER/nizamkitchen:sha-$(git rev-parse --short HEAD)." >&2
  exit 1
fi

if [ -z "$PROD_HOST" ]; then
  echo "Set PROD_HOST to the SSH host, for example ubuntu@example.com." >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  echo "docker is required locally." >&2
  exit 1
}

echo "Building and pushing $IMAGE for $PLATFORM..."
docker buildx build --platform "$PLATFORM" -t "$IMAGE" --push .

echo "Deploying on $PROD_HOST..."
if [ -n "$SSH_KEY" ]; then
  ssh -i "$SSH_KEY" "$PROD_HOST" "cd '$PROD_PATH' && NIZAMKITCHEN_IMAGE='$IMAGE' APP_URL='$APP_URL' ./scripts/ops/pull-and-restart.sh"
else
  ssh "$PROD_HOST" "cd '$PROD_PATH' && NIZAMKITCHEN_IMAGE='$IMAGE' APP_URL='$APP_URL' ./scripts/ops/pull-and-restart.sh"
fi
