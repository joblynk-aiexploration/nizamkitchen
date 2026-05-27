# Incident Response

Use this document when production is degraded, unavailable, or behaving suspiciously.

## Severity

- `SEV1`: app unavailable, data loss risk, active security incident, or production database unavailable.
- `SEV2`: major workflow broken for many users, payments/billing placeholder misbehavior, or admin operations blocked.
- `SEV3`: isolated feature issue with workaround.

## First 15 Minutes

1. Confirm the incident with `/api/health` and the affected workflow.
2. Assign one incident lead.
3. Capture current Git commit, image tag, deployment time, and recent changes.
4. Check app, Postgres, Redis, and nginx logs.
5. If customer data is at risk, stop writes by disabling the affected feature flag or temporarily blocking traffic.
6. Communicate status internally with facts only.

## Commands

Health:

```bash
APP_URL=https://app.example.com ./scripts/ops/health-check.sh
```

Logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=300 app
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Restart app:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart app
```

## Common Responses

### Database Unreachable

- Confirm Postgres container or managed database status.
- Check disk usage.
- Check recent migration logs.
- Restore only after confirming the backup and target.

### Bad Deployment

- Redeploy the previous known-good image.
- Avoid destructive schema rollback unless a tested database restore is required.
- Keep the failed image tag for investigation.

### Optional Provider Outage

- Disable the related feature flag if users are impacted.
- Missing Google Maps Platform, YouTube, SMTP, or Stripe placeholder config should degrade cleanly.
- Never paste provider keys into logs or incident notes.

### Suspicious Access

- Preserve logs.
- Rotate affected API keys or secrets.
- Disable compromised user accounts.
- Review `/admin/audit-logs`.
- If session compromise is suspected, rotate `SESSION_SECRET` during emergency maintenance to invalidate sessions.

## Post-Incident Review

Within 48 hours, document:

- Timeline.
- Root cause.
- Customer impact.
- What worked.
- What failed.
- Follow-up fixes.
- Monitoring or runbook updates.

Do not include secrets, private customer data, or raw credentials in the incident report.
