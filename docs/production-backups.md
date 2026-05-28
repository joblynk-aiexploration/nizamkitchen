# Production Backups

NizamKitchen production data lives in PostgreSQL. Backups must be encrypted, access-controlled, and stored outside Git.

## Recommended Schedule

- Run full logical backups at least daily.
- Keep 7 daily backups, 4 weekly backups, and 6 monthly backups.
- Store backups in durable object storage with lifecycle retention and restricted access.
- Test restore procedures on a non-production database at least monthly.

## Backup Command

Use `pg_dump` from a trusted operations host or a temporary container:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  --host "$POSTGRES_HOST" \
  --port "${POSTGRES_PORT:-5432}" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --file "backups/nizamkitchen-$(date +%Y%m%d-%H%M%S).dump"
```

## Restore Command

Restore into a clean database after confirming the target is correct:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  --host "$POSTGRES_HOST" \
  --port "${POSTGRES_PORT:-5432}" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --clean \
  --if-exists \
  "backups/nizamkitchen-YYYYMMDD-HHMMSS.dump"
```

## Local Docker Example

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump \
  -U postgres \
  -d nizamkitchen \
  --format custom \
  > backups/nizamkitchen-local.dump
```

Restore locally:

```bash
docker compose exec -T postgres pg_restore \
  -U postgres \
  -d nizamkitchen \
  --clean \
  --if-exists \
  < backups/nizamkitchen-local.dump
```

## Safety Rules

- Never commit backups to Git.
- Never paste production credentials into documentation or issue trackers.
- Prefer managed database snapshots for infrastructure-level recovery and logical `pg_dump` backups for portability.
- Verify backups before deleting old retention windows.
