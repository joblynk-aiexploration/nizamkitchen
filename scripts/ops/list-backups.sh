#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  ./scripts/ops/list-backups.sh

Optional:
  BACKUP_DIR=backups

Lists local PostgreSQL backup files newest first. Backups must never be committed to Git.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory does not exist: $BACKUP_DIR"
  exit 0
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "*.dump" -o -name "*.backup" \) -print \
  | sort -r \
  | while IFS= read -r file; do
      size="$(du -h "$file" | awk '{print $1}')"
      printf "%s\t%s\n" "$size" "$file"
    done
