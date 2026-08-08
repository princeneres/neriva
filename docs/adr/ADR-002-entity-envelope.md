# ADR-002: Standard entity envelope

Status: accepted. Date: 2026-08-08.

## Context

Every persisted entity in Neriva needs the same cross-cutting behavior: stable identity, idempotent import/upsert, multi-tenant readiness, auditability and (where applicable) a publication lifecycle and client-defined fields. Repeating these columns ad hoc per table invites drift; inheritance-based base entities hide the schema.

## Decision

Every enveloped table spreads shared column helpers (`envelopeColumns`, `statusColumn`, `customFieldsColumn` in `apps/api/src/db/schema/envelope.ts`):

- `id`: UUIDv7 primary key, generated in the application. Time-ordered, so `ORDER BY id` doubles as creation order and drives cursor pagination.
- `externalReferenceCode` (ERC): unique per tenant and entity type, auto-generated when omitted. Enables idempotent upserts and content migration between environments. URL ids accept `erc:<code>` as an alternative to the UUID.
- `tenantId`: present and enforced from day one, even though v1 ships single-tenant deploys. `TenantScopedRepository` injects the tenant filter into every statement, so an unscoped query cannot be written through the repository.
- `createdAt`, `updatedAt`, `createdBy`: audit fields. `createdBy` is null for system-created rows.
- `status` (`DRAFT | PUBLISHED | ARCHIVED`): only on entities with a publication lifecycle.
- `customFields` JSONB: only on extensible entities. Client-defined fields are metadata plus JSONB, never `CREATE TABLE` at runtime.

Column helpers are spread into each table definition instead of using ORM inheritance, so every table reads complete at its declaration site.

## Consequences

- New feature modules get identity, tenancy, upsert and pagination behavior by composition: spread the helpers, instantiate `TenantScopedRepository`.
- Generic typing over Drizzle tables requires a few documented casts inside the repository; the trade was accepted to keep call sites fully typed.
- UUIDv7 ordering assumptions are documented in the repository; if an entity ever needs a different sort order, it needs its own cursor strategy.
- The ERC uniqueness constraint is `(tenantId, externalReferenceCode)` per table, which keeps codes portable across tenants.
