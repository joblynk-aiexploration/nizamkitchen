#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  POSTGRES_HOST=... POSTGRES_USER=... POSTGRES_DB=... POSTGRES_PASSWORD=... BACKUP_FILE=backups/nizamkitchen-YYYYMMDD-HHMMSS.dump ./scripts/ops/restore-postgres.sh

Optional:
  POSTGRES_PORT=5432

Restores a PostgreSQL custom-format dump into the target database. Confirm the target before running.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

command -v pg_restore >/dev/null 2>&1 || {
  echo "pg_restore is required. Install PostgreSQL client tools on this host." >&2
  exit 1
}

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
