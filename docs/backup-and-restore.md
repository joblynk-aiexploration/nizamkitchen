# Backup and Restore

PostgreSQL is the source of truth for NizamKitchen production data. Backups must be encrypted, access-controlled, tested, and stored outside Git.

## Backup Script

```bash
POSTGRES_HOST=127.0.0.1 \
POSTGRES_USER=nizamkitchen \
POSTGRES_DB=nizamkitchen \
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
BACKUP_DIR=backups \
./scripts/ops/backup-postgres.sh
```

The script writes timestamped files like:

```text
backups/nizamkitchen-20260519-101530.dump
```

## List Backups

```bash
BACKUP_DIR=backups ./scripts/ops/list-backups.sh
```

## Restore Script

```bash
POSTGRES_HOST=127.0.0.1 \
POSTGRES_USER=nizamkitchen \
POSTGRES_DB=nizamkitchen \
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
BACKUP_FILE=backups/nizamkitchen-YYYYMMDD-HHMMSS.dump \
./scripts/ops/restore-postgres.sh
```

The restore script waits briefly before running so operators can cancel if the target is wrong.

## Docker Local Example

Create a local backup from Docker:

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

## Recommended Schedule

- Daily logical backups.
- Retain 7 daily, 4 weekly, and 6 monthly backups.
- Use managed database snapshots where available.
- Copy backups to durable object storage.
- Test restores monthly on non-production infrastructure.

## Before Migrations

1. Confirm current app version and database target.
2. Run a fresh backup.
3. Verify backup file size is plausible.
4. Run `prisma migrate deploy`.
5. Run `/api/health`.
6. Smoke test login, admin dashboard, recipes, grocery lists, and key workflows.

## Safety Rules

- Never commit backups.
- Never commit `.env.production`.
- Never store backups in the same only disk as production without off-host copies.
- Never restore over production unless the incident lead confirms the target.
- Keep restore credentials in a password manager or secret manager.
