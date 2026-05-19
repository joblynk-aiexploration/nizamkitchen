# Operations Runbook

This runbook is for maintaining NizamKitchen after launch. Keep secrets in the production environment, password manager, or cloud secret store. Do not paste credentials into Git, tickets, screenshots, or chat.

## Check App Health

```bash
APP_URL=https://app.example.com ./scripts/ops/health-check.sh
```

Expected result: HTTP 200 from `/api/health` with `ok: true`, database reachable, and migrations reachable.

Additional probes:

```bash
curl -fsS https://app.example.com/api/health/db
curl -fsS https://app.example.com/api/health/redis
curl -fsS https://app.example.com/api/health/storage
```

## Check Logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 postgres
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 redis
```

Logs should not include secrets. The server logger redacts obvious secret-like keys such as passwords, tokens, API keys, cookies, authorization headers, DSNs, and database URLs.

## Restart Containers

Restart only the app:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart app
```

Restart the full stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Run Migrations

Always back up PostgreSQL before production migrations.

```bash
./scripts/ops/backup-postgres.sh
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml ./scripts/ops/run-migrations.sh
APP_URL=https://app.example.com ./scripts/ops/health-check.sh
```

Production migrations must use `prisma migrate deploy`; never use `prisma migrate dev` on production.

## Back Up PostgreSQL

```bash
POSTGRES_HOST=127.0.0.1 \
POSTGRES_USER=nizamkitchen \
POSTGRES_DB=nizamkitchen \
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
BACKUP_DIR=backups \
./scripts/ops/backup-postgres.sh
```

List backups:

```bash
./scripts/ops/list-backups.sh
```

Store backups outside Git in encrypted object storage or a managed database snapshot system.

## Restore PostgreSQL

Restore into a known target only after confirming the app is stopped or traffic is drained.

```bash
POSTGRES_HOST=127.0.0.1 \
POSTGRES_USER=nizamkitchen \
POSTGRES_DB=nizamkitchen \
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
BACKUP_FILE=backups/nizamkitchen-YYYYMMDD-HHMMSS.dump \
./scripts/ops/restore-postgres.sh
```

Run health checks immediately after restore.

## Check Disk Usage

```bash
df -h
docker system df
du -sh backups
docker volume ls
```

If disk pressure is high, first preserve the newest verified backups off-host, then prune old Docker artifacts:

```bash
docker image prune
docker builder prune
```

Do not delete PostgreSQL volumes unless executing a tested restore plan.

## Rotate API Keys

1. Create the new provider key in the provider console.
2. Update `.env.production` on the server or the secret manager.
3. Restart the app container.
4. Confirm `/admin/system` shows the integration configured.
5. Test the relevant workflow.
6. Revoke the old provider key.

Rotate `SESSION_SECRET` only during a planned maintenance window because existing sessions will become invalid.

## Disable Feature Flags

Use `/admin/feature-flags` as a platform owner/admin. Disabling a feature flag should create an audit log and show a clean disabled state for users.

If the admin UI is unavailable, use a direct database update only as an emergency break-glass action and record the incident afterwards.

## Emergency Rollback

1. Stop new traffic through nginx or Cloudflare if the issue is severe.
2. Capture logs and the current Git commit/image tag.
3. Run a database backup if the database is still healthy.
4. Redeploy the previous known-good Docker image.
5. Do not roll back database schema unless the rollback plan explicitly requires a restore.
6. Run `/api/health` and a manual smoke test.
7. Document the incident and follow up with a forward fix.

## Audit Log Coverage

The product workflows create audit events for authentication, feature flags, billing/admin changes, home chef requests, chef profile changes, restaurant fallback search/save actions, grocery exports/share links, YouTube discovery/import actions, and admin user changes. Use `/admin/audit-logs` for investigation.
