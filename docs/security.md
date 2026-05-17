# Operational Security Notes

## Deployment security

- Terminate TLS at a reverse proxy or load balancer.
- Set `NODE_ENV=production` in all deployed environments.
- Use strong, rotated secrets for database, SMTP, storage, and session infrastructure.

## Application security

- Session cookies are HTTP-only and secure in production.
- Protected routes are pre-gated by middleware and re-validated server-side.
- Sensitive denied-access events are audit logged.

## Infrastructure security

- Restrict Postgres and Redis to private networking in production.
- Use least-privilege object storage credentials.
- Avoid public admin endpoints without network and application-layer protection.
