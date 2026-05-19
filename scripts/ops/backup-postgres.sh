#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  POSTGRES_HOST=... POSTGRES_USER=... POSTGRES_DB=... POSTGRES_PASSWORD=... ./scripts/ops/backup-postgres.sh

Optional:
  POSTGRES_PORT=5432
  BACKUP_DIR=backups

Creates a timestamped PostgreSQL custom-format dump. No credentials are stored in this script.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

command -v pg_dump >/dev/null 2>&1 || {
  echo "pg_dump is required. Install PostgreSQL client tools on this host." >&2
  exit 1
}

: "${POSTGRES_HOST:?Set POSTGRES_HOST}"
: "${POSTGRES_USER:?Set POSTGRES_USER}"
: "${POSTGRES_DB:?Set POSTGRES_DB}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}"

BACKUP_DIR="${BACKUP_DIR:-backups}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/nizamkitchen-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --file "$OUTPUT_FILE"

echo "Backup written to $OUTPUT_FILE"
