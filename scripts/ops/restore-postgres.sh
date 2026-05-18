#!/usr/bin/env sh
set -eu

: "${POSTGRES_HOST:?Set POSTGRES_HOST}"
: "${POSTGRES_USER:?Set POSTGRES_USER}"
: "${POSTGRES_DB:?Set POSTGRES_DB}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}"
: "${BACKUP_FILE:?Set BACKUP_FILE to the .dump file to restore}"

POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "Restoring $BACKUP_FILE into $POSTGRES_DB on $POSTGRES_HOST"
echo "Press Ctrl+C within 5 seconds to cancel."
sleep 5

PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --clean \
  --if-exists \
  "$BACKUP_FILE"

echo "Restore completed."
