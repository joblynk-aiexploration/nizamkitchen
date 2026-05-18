# Environment Variables

## Required core variables

- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: required in production; at least 32 random characters.
- `SESSION_COOKIE_NAME`: HTTP-only session cookie name.
- `SESSION_DURATION_DAYS`: session lifetime.
- `APP_URL`: canonical app URL; required in production.
- `NODE_ENV`: `development`, `test`, or `production`; production performs stricter validation at runtime.

## Infrastructure variables

- `REDIS_URL`: Redis connection URL.
- `OBJECT_STORAGE_ENDPOINT`: S3-compatible storage endpoint.
- `OBJECT_STORAGE_BUCKET`: primary bucket name.
- `OBJECT_STORAGE_REGION`: storage region string.
- `OBJECT_STORAGE_ACCESS_KEY`: access key placeholder.
- `OBJECT_STORAGE_SECRET_KEY`: secret key placeholder.

## Email variables

- `SMTP_HOST`: SMTP server hostname.
- `SMTP_PORT`: SMTP server port.
- `SMTP_USER`: SMTP username.
- `SMTP_PASS`: SMTP password.
- `EMAIL_FROM`: default sender.

## Optional provider variables

- `MAPTILER_API_KEY`: server-only MapTiler key for restaurant fallback.
- `NEXT_PUBLIC_MAPTILER_API_KEY`: browser-safe MapTiler key for map display.
- `MAPTILER_RESTAURANT_DISCOVERY_ENABLED`: enables restaurant search when a server key is present.
- `YOUTUBE_DATA_API_KEY`: server-only YouTube Data API key for discovery and availability checks.
- `YOUTUBE_DISCOVERY_ENABLED`: enables YouTube discovery when a server key is present.

## Observability variables

- `LOG_LEVEL`: `debug`, `info`, `warn`, or `error`.
- `DEPLOYMENT_ENVIRONMENT`: environment label such as `local`, `staging`, or `production`.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: placeholder tracing export endpoint.
- `SENTRY_DSN`: placeholder error monitoring DSN.

## Secret handling

- Keep `.env`, `.env.production`, and CI secrets outside version control.
- Use GitHub Actions encrypted secrets for future deploy automation.
