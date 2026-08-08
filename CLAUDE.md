# Neriva CMS

Lightweight, headless-first CMS inspired by Liferay DXP's best ideas (pages, fragments, web content, roles/permissions, style book) without its weight or OSGi complexity. Built from scratch. Target: runs comfortably on modest infra (single Node container + PostgreSQL).

## Stack (locked, do not substitute)

- **Backend:** NestJS with the Fastify adapter (TypeScript, strict mode)
- **Database:** PostgreSQL 16+. System tables are static; client-defined fields live in JSONB columns
- **Data layer:** Drizzle ORM (schema + migrations). Kysely allowed ONLY for dynamic query building over runtime-defined Object fields
- **Frontend:** Next.js (App Router) for both Admin UI and the page rendering runtime
- **Authorization:** CASL (scoped RBAC)
- **API:** REST, OpenAPI 3.1 spec is the contract and source of truth (`/docs/api/openapi.yaml`)

## Non-negotiable principles

1. **Headless-first.** Every capability available in the Admin UI MUST be achievable through the REST API. The Admin UI is just another API client. No admin-only backdoors.
2. **Spec before code.** Features are specified in `/docs/specs/<feature>.md` and reflected in the OpenAPI spec before implementation. If implementation and spec diverge, the spec wins; fix the code or update the spec explicitly in the same PR.
3. **Standard entity envelope.** Every persisted entity has: `id` (UUIDv7), `externalReferenceCode` (unique per tenant+type, used for idempotent upsert and migration), `tenantId`, `createdAt`, `updatedAt`, `createdBy`, `status` (DRAFT | PUBLISHED | ARCHIVED where applicable), and `customFields` (JSONB) when the entity is extensible.
4. **Single-tenant deploys, multi-tenant-ready data model.** `tenantId` is present and enforced in every query from day 1, even though v1 ships as one deploy per client. Never write a query without tenant scoping.
5. **Modules, not plugins (yet).** Each capability is a NestJS module with a public interface (exported services + DTOs). Modules never import another module's internals. This keeps a future plugin system possible without building one now.
6. **No dynamic DDL.** Client-defined Objects and fields are metadata rows + JSONB, never CREATE TABLE at runtime.
7. **Boring, explicit code beats clever code.** This project is also an architecture portfolio; readability is a feature.

## Domain naming (use these terms everywhere: code, API, UI, docs)

| Neriva term                | Liferay equivalent            |
| -------------------------- | ----------------------------- |
| Site                       | Site/Group                    |
| Page                       | Layout                        |
| Block                      | Fragment                      |
| Content Type               | DDM Structure                 |
| Content Entry              | Web Content / Journal Article |
| Object                     | Liferay Object                |
| Style Book / Design Tokens | Style Book / Frontend Tokens  |
| Role / Permission          | Role / Resource Permission    |

## Architecture map

```
apps/
  api/          NestJS app (modules: auth, users, roles, sites, pages,
                blocks, content, objects, stylebook, system)
  web/          Next.js app (admin UI + page rendering runtime)
packages/
  contracts/    OpenAPI-generated types + shared DTOs (single source)
  ui/           shared React components + design tokens
docs/
  specs/        one spec per feature (SDD)
  api/          openapi.yaml
  adr/          architecture decision records (ADR-NNN-title.md)
```

## Key domain rules

- **Pages are data.** A Page is a JSON tree of Block instances (block ref + prop values + slot children). The rendering runtime composes it; headless clients consume the raw JSON.
- **Blocks are typed components.** A Block declares a JSON schema of configurable props + named slots. No string-template HTML editing (no FreeMarker-style approach).
- **Style Book = design token set.** Tokens (colors, spacing, typography, radii) are a versioned entity; Blocks consume tokens via CSS variables. Default token set uses primary color `#cc3d47`, minimalist neutral palette.
- **Permissions:** Role -> allowed actions (create/read/update/delete/publish) on resource types, scoped to tenant or site. Implemented as CASL abilities built from DB rows. Deny by default.
- **Bootstrap:** first boot seeds tenant "default", role "Administrator", and user `admin@neriva.com` / password `admin` with `mustChangePassword=true`. Login while that flag is set forces a password change before anything else.
- **System settings** (SMTP, site metadata, etc.) are editable in Admin UI and via API; database connection remains environment-level config (env vars), not portal-editable.

## Coding conventions

- All code, identifiers, comments, commit messages: **English**. Comments only where strictly necessary.
- TypeScript `strict: true` everywhere. No `any` without an inline justification comment.
- API responses use a standard envelope: `{ data, meta }` for success; RFC 7807 problem+json for errors.
- Pagination: cursor-based, `?limit=&cursor=`, default limit 20, max 100.
- IDs in URLs accept either UUID or `erc:<externalReferenceCode>`.
- Conventional Commits. One feature branch per module in Phase B.
- Never use em dashes in any prose or docs; use commas, colons, or separate sentences.

## Verification loop (must pass before any diff is presented)

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- Every module ships with unit tests for services and e2e tests for its REST endpoints (Testcontainers Postgres).
- Do not weaken or skip tests to make them pass. If a test is wrong, fix the test and say so.

## Workflow

- **Phase A (current): serial.** One session at a time. Build the walking skeleton: entity envelope base, auth, permissions, migrations, response envelope, verification loop, CI. Conventions get frozen here.
- **Phase B: parallel.** One agent per module in its own git worktree, contracts frozen, auto mode + code review. Do not start Phase B work until Phase A items in `/docs/specs/00-skeleton.md` are checked off.
- Significant architectural decisions get an ADR in `/docs/adr/` (short: context, decision, consequences).
- When uncertain about a domain rule, check `/docs/specs/` first, then ask; do not invent conventions.
