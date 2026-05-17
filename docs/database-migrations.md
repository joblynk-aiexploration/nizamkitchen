# Database Migrations

## Development

- Create or update schema changes in `prisma/schema.prisma`.
- Run `npm run db:migrate` during local development.
- Regenerate the Prisma client with `npm run db:generate` if needed.

## Production

- Production must use `npm run db:deploy`.
- `prisma migrate deploy` is non-interactive and safe for CI/CD pipelines.
- Run migrations before shifting production traffic to a new app version.

## Release pattern

1. Build and validate the application in CI.
2. Build the Docker image.
3. Deploy infrastructure changes if needed.
4. Run `npm run db:deploy`.
5. Roll out the application containers.
