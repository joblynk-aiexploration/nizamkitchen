# Infrastructure Overview

NizamKitchen is currently prepared for a pragmatic single-VPS deployment while keeping the architecture portable to AWS ECS/Fargate later.

## Runtime components

- `app`: Next.js standalone container
- `postgres`: primary relational database
- `redis`: cache, queue, and rate-limit backing placeholder
- `object storage`: MinIO locally, S3-compatible service later
- `smtp provider`: Mailpit locally, production SMTP provider later

## Environments

- Local development: `docker-compose.yml`
- Production example: `docker-compose.prod.example.yml`
- CI validation: GitHub Actions workflow in `.github/workflows/ci.yml`

## Portability notes

- Docker image is build-once, run-anywhere.
- Prisma production migrations use `npm run db:deploy`.
- Object storage is modeled via generic S3-compatible environment variables rather than a vendor-specific SDK.
- Redis is referenced via URL so it can move from a container to ElastiCache or Redis Cloud later.
