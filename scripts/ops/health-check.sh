#!/usr/bin/env sh
set -eu

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${APP_URL%/}/api/health"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-10}"

echo "Checking $HEALTH_URL"

if command -v curl >/dev/null 2>&1; then
  curl --fail --silent --show-error --max-time "$TIMEOUT_SECONDS" "$HEALTH_URL"
else
  wget -qO- --timeout="$TIMEOUT_SECONDS" "$HEALTH_URL"
fi

echo
echo "Health check passed."
