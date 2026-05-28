# Operations

This runbook covers everyday production operations for NizamKitchen.

## Core Health Checks

```bash
APP_URL=https://app.example.com ./scripts/ops/health-check.sh
curl -fsS https://app.example.com/api/health
curl -fsS https://app.example.com/api/health/db
curl -fsS https://app.example.com/api/health/storage
curl -fsS https://app.example.com/api/health/payments
curl -fsS https://app.example.com/api/health/integrations
```

## Admin Operations Pages

- `/admin/system`
- `/admin/system/health`
- `/admin/system/integrations`
- `/admin/system/logs`
- `/admin/system/alerts`
- `/admin/audit-logs`
- `/admin/feature-flags`

## Logs

Application logs should use structured logging and redact secret-like fields such as passwords, tokens, API keys, DSNs, cookies, authorization headers, and database URLs.

Example Docker log commands:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 postgres
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 redis
```

## Routine Tasks

- Restart app containers if needed.
- Run production migrations only with `prisma migrate deploy`.
- Back up PostgreSQL before risky changes.
- Verify webhook failures, storage failures, and system alerts from the admin system pages.
- Disable feature flags rather than removing code during incidents.

## Security Notes

- Do not paste secrets into logs, tickets, screenshots, or chat.
- Do not expose object storage, payment, or KYC credentials through admin UI.
- Uploaded files and backups must remain outside Git.
- Demo accounts and local-only shortcuts are not valid production controls.

## What Is Still Manual

- Some dispute handling
- Some payout review workflows
- Some KYC/provider escalation flows
- Final legal/document review before launch

## Launch Checklist

- Confirm production env vars are loaded from a secret store or server-only env file.
- Confirm backups and restore scripts are tested.
- Confirm `/admin/system` shows expected integration status.
- Confirm alert routes and audit logs are functioning.
- Confirm optional integrations fail gracefully when intentionally disabled.
