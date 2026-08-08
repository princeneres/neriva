# ADR-001: Stack selection

Status: accepted. Date: 2026-08-08.

## Context

Neriva rebuilds the useful ideas of Liferay DXP (pages from fragments, structured content, scoped RBAC, style book) without OSGi weight. It must run on modest infrastructure (one Node container plus PostgreSQL), stay readable as an architecture portfolio, and remain headless-first with the REST API as the only integration surface.

## Decision

- **NestJS with the Fastify adapter** for the API. Nest gives modules with explicit public interfaces (the future plugin seam), dependency injection and first-class OpenAPI generation; Fastify keeps the HTTP layer light.
- **PostgreSQL 16+** as the only datastore. System tables are static; client-defined Objects and fields live in JSONB columns. No dynamic DDL at runtime, ever.
- **Drizzle ORM** for schema and migrations: SQL-shaped, no runtime magic, migrations are plain SQL files. Kysely is allowed only for dynamic query building over runtime-defined Object fields, where a query builder beats an ORM.
- **Next.js App Router** for both the Admin UI and the page rendering runtime, consuming the same public API as any headless client.
- **CASL** for authorization: abilities are built per request from role permission rows, deny by default.
- **OpenAPI 3.1** as the API contract, generated from code decorators into `docs/api/openapi.yaml`, committed and verified in CI. `packages/contracts` exports generated types so clients cannot drift from the contract silently.
- **pnpm monorepo** with plain `tsc` builds and Vitest (unit + Testcontainers e2e). Runtime scripts use ts-node because esbuild-based runners do not emit the decorator metadata Nest DI requires.

## Consequences

- One deployable API container and one database keep operations simple; horizontal scale is a later concern.
- Drizzle keeps the data layer explicit but means hand-rolling some generic repository typing (see TenantScopedRepository).
- Committing the generated spec and types adds a CI freshness check but removes an entire class of client/server drift bugs.
- Choosing boring, mainstream tools is deliberate: readability is a feature of this codebase.
