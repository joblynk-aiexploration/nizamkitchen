# ADR 0001: Modular Monolith With Enterprise Boundaries

## Status

Accepted

## Context

NizamKitchen includes public marketing, multi-role SaaS workspaces, marketplace workflows, billing, accounting, storage, KYC, email, notifications, and platform administration. The platform needs production safety and modularity without prematurely adding distributed-system complexity.

## Decision

NizamKitchen will remain a modular monolith for the current enterprise release. Bounded contexts are documented and enforced through folder/service ownership, Prisma model boundaries, RBAC checks, and provider adapters. Domain services under `src/server/*` remain the primary boundary for business logic. API routes, server components, and server actions should orchestrate workflows but not contain deep domain rules.

## Consequences

- Faster product iteration and simpler deployment than microservices.
- Stronger consistency for payments, accounting, orders, and tenant access.
- Requires discipline to prevent cross-context imports and large Prisma includes.
- Future service extraction remains possible for payments, notifications/email, storage, and marketplace search.

## Future Evolution

- Add event outbox before introducing asynchronous workers at scale.
- Add OpenTelemetry tracing and structured request correlation.
- Version public APIs under `/api/v1` before external developer adoption.
- Consider service extraction only after bounded contexts have stable contracts and operational metrics.

