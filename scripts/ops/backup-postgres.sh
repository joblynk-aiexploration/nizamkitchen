#!/usr/bin/env sh
set -eu

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
