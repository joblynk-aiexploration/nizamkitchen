# Backup And Restore

## PostgreSQL backups

- Use nightly `pg_dump` for logical backups.
- Use volume or snapshot-based backups for fast disaster recovery.
- Store encrypted backups off-host.

Example placeholder command:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=/backups/nizamkitchen-$(date +%F).dump
```

## Redis backups

- Enable AOF or snapshot persistence.
- Treat Redis as reconstructible unless future product modules depend on durable queue state.

## Object storage backups

- Use bucket versioning and lifecycle rules when moving to production object storage.
- Replicate critical assets to a second region later if recovery objectives require it.

## Restore pattern

1. Restore PostgreSQL from the latest verified backup.
2. Recreate Redis if needed.
3. Restore object storage data or versioned objects.
4. Run health checks and smoke tests.
