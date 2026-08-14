# Neriva CMS

Lightweight, headless-first CMS inspired by Liferay DXP's best ideas (pages, fragments, web content, roles/permissions, style book) without its weight or OSGi complexity. Built from scratch. Target: runs comfortably on modest infra (single Node container + PostgreSQL).

## Stack (locked, do not substitute)

- **Backend:** NestJS with the Fastify adapter (TypeScript, strict mode)
- **Database:** PostgreSQL 16+. System tables are static; client-defined fields live in JSONB columns
- **Data layer:** Drizzle ORM (schema + migrations). Kysely allowed ONLY for dynamic query building over runtime-defined Object fields
- **Frontend:** Next.js (App Router) for both Admin UI and the page rendering runtime
- **Admin UI kit:** Mantine v8 (`core`, `form`, `hooks`, `modals`, `notifications`, `dropzone`) + `@tabler/icons-react`, theme in `apps/web/lib/theme.ts`. dnd-kit for studio drag and drop. Do not add another component, form, or data-fetching library
- **Authorization:** CASL (scoped RBAC)
- **API:** REST, OpenAPI 3.1 spec is the contract and source of truth (`docs/api/openapi.yaml`)
- **Tests:** Vitest everywhere. API e2e uses Testcontainers PostgreSQL, so Docker must be running

## Non-negotiable principles

1. **Headless-first.** Every capability available in the Admin UI MUST be achievable through the REST API. The Admin UI is just another API client. No admin-only backdoors.
2. **Spec before code.** Features are specified in `docs/specs/<feature>.md` and reflected in the OpenAPI spec before implementation. If implementation and spec diverge, the spec wins; fix the code or update the spec explicitly in the same PR.
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
| Page Template              | Page Template                 |
| Master Page                | Master Page Template          |
| Content Type               | DDM Structure                 |
| Content Entry              | Web Content / Journal Article |
| Object                     | Liferay Object                |
| Style Book / Design Tokens | Style Book / Frontend Tokens  |
| Media File / Media Folder  | Documents and Media           |
| Delivery API               | Headless Delivery             |
| Trash                      | Recycle Bin                   |
| Role / Permission          | Role / Resource Permission    |

## Repo map

```
apps/api/src/
  common/       cross-cutting infra: envelope interceptor, problem+json filter,
                pagination, entity-ref (uuid | erc:<code>), style tokens
  db/           drizzle schema, migration runner, seeds (bootstrap, native blocks,
                native master page, demo data)
  modules/      auth, users, roles, sites, pages, page-templates, blocks, content,
                objects, stylebook, media, delivery, system
  test/         *.e2e-spec.ts per module (Testcontainers)
apps/web/
  app/admin/    one folder per admin section, screens are client components
  app/s/, app/[...path]/   public rendering runtime (see site navigation below)
  lib/renderer/ block template engine + native block registry
  lib/          api client, auth storage, delivery fetchers, theme
packages/
  contracts/    types generated from openapi.yaml + shared envelope types
  ui/           design tokens only (tokens.css). No shared components yet
docs/
  specs/        one spec per feature (SDD)
  api/          openapi.yaml
  adr/          architecture decision records (ADR-NNN-title.md)
scripts/
  dev.mjs       one-command dev bootstrap: embedded PostgreSQL + API + web (ADR-004)
```

## Key domain rules

- **Pages are data.** A Page is a JSON tree of Block instances (block ref + prop values + slot children + per-instance styles). The rendering runtime composes it; headless clients consume the raw JSON.
- **Blocks are authorable templates** (ADR-003). A Block declares a JSON schema of configurable props + named slots, and optionally an HTML+CSS template with editable-field bindings (`data-nv-*`) authored in the admin, Liferay-fragment style. Templates are data (escaped interpolation, sanitized on write), never server-side code execution. Blocks without `html` fall back to the native registry in `apps/web/lib/renderer/registry.tsx`.
- **Master Pages and Page Templates.** A Master Page wraps every page that references it (header/footer around a content outlet). A non-master Page Template is a pre-filled starting point copied into a new page, with no live link afterwards.
- **Style Book = design token set.** Tokens (colors, spacing, typography, radii) are a versioned entity; Blocks consume tokens via CSS variables. Default token set uses primary color `#cc3d47`, minimalist neutral palette.
- **Delivery API is public and anonymous.** It serves only PUBLISHED content plus the site CSS, with no token. Every other endpoint requires auth. Public media is served by `media-public.controller.ts`.
- **Site-first navigation.** `/` and any non-reserved path serve the default site's published page; `/s/<slug>/<path>` serves any site; the admin lives under `/admin`. Reserved paths are listed in `apps/web/lib/reserved-paths.ts`.
- **Media** files live on disk under `MEDIA_STORAGE_DIR` (default `apps/api/uploads`, gitignored), metadata in `media_files` / `media_folders`.
- **Permissions:** Role -> allowed actions (create/read/update/delete/publish) on resource types, scoped to tenant or site. Implemented as CASL abilities built from DB rows. Deny by default.
- **Bootstrap:** first boot seeds tenant "default", roles "Administrator" and "Content Manager", user `admin@neriva.com` / password `admin` with `mustChangePassword=true`, native blocks and a native master page. Login while that flag is set forces a password change before anything else.
- **Dev bootstrap (ADR-004):** `pnpm dev` starts an embedded PostgreSQL 16 in `.neriva/pgdata` (port 5433) unless `DATABASE_URL` is set, which always wins. Migrations run on API boot outside production (`RUN_MIGRATIONS` defaults to true when `NODE_ENV !== 'production'`). The API dev server uses the SWC builder, so type errors surface in `pnpm typecheck`, not in the dev output.
- **System settings** (SMTP, site metadata, etc.) are editable in Admin UI and via API; database connection remains environment-level config (env vars), not portal-editable.

## Feature specs (read the spec before touching the area)

| Spec                 | Area                                            | State                            |
| -------------------- | ----------------------------------------------- | -------------------------------- |
| `00-skeleton`        | Phase A walking skeleton checklist              | done                             |
| `01-sites`           | Sites                                           | implemented                      |
| `02-blocks`          | Blocks v1 (JSON schema props + slots)           | superseded by `12` for authoring |
| `03-pages`           | Pages, block trees, publish flow                | implemented                      |
| `04-content`         | Content Types + Content Entries                 | implemented                      |
| `05-objects`         | Objects (JSONB entities, dynamic filtering)     | implemented                      |
| `06-stylebook`       | Style Book tokens + CSS endpoint                | implemented                      |
| `07-system-settings` | System settings                                 | implemented                      |
| `08-admin-ui`        | Admin UI API-client rules                       | visual rules superseded by `09`  |
| `09-admin-ui-v2`     | Admin design system (Mantine, IA, UX)           | current                          |
| `10-delivery`        | Public delivery API                             | implemented                      |
| `11-media`           | Media library                                   | implemented                      |
| `12-blocks-v2`       | Block templates, native components, node styles | implemented                      |
| `13-site-navigation` | Site-first routing, default site                | implemented                      |
| `14-page-templates`  | Page Templates + Master Pages                   | implemented                      |
| `15-trash`           | Recycle Bin                                     | admin UI only, API missing       |

## Commands

```
pnpm install
pnpm dev                                          # embedded PostgreSQL + API :3001 + web :3000
pnpm dev --no-demo                                # same, without the demo content seed
pnpm dev --db-only                                # only the database
docker compose up -d                              # optional production-like PostgreSQL 16
pnpm --filter @neriva/api db:migrate              # apply migrations (production path)
pnpm --filter @neriva/api dev                     # REST API alone on :3001
pnpm --filter @neriva/web dev                     # Admin UI + runtime alone on :3000
pnpm --filter @neriva/api db:generate             # new migration from schema changes
pnpm --filter @neriva/api openapi:generate        # regenerate docs/api/openapi.yaml
pnpm --filter @neriva/contracts generate          # regenerate typed contracts
pnpm verify                                       # lint + typecheck + test + build
```

## Contract sync (CI fails otherwise)

After changing any controller, DTO, or Swagger decorator, run `openapi:generate` then the contracts `generate` and commit both. CI runs `git diff --exit-code docs/api/openapi.yaml packages/contracts/src/generated`, so drift is a hard failure.

## Coding conventions

- All code, identifiers, comments, commit messages: **English**. Comments only where strictly necessary.
- TypeScript `strict: true` everywhere. No `any` without an inline justification comment.
- API responses use a standard envelope: `{ data, meta }` for success; RFC 7807 problem+json for errors.
- Pagination: cursor-based, `?limit=&cursor=`, default limit 20, max 100.
- IDs in URLs accept either UUID or `erc:<externalReferenceCode>`.
- API tests: `src/**/*.spec.ts` for units, `test/**/*.e2e-spec.ts` for endpoints. Web tests only run under `apps/web/lib/**/*.spec.ts`, so extract testable logic out of `app/` into `lib/`.
- Conventional Commits. One feature branch per feature, merged into `master` with a merge commit.
- Never use em dashes in any prose or docs; use commas, colons, or separate sentences.

## Verification loop (must pass before any diff is presented)

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- Every module ships with unit tests for services and e2e tests for its REST endpoints (Testcontainers Postgres, so Docker must be up).
- Do not weaken or skip tests to make them pass. If a test is wrong, fix the test and say so.

## Current state

Phase A (walking skeleton) is complete and its conventions are frozen. Specs 01 to 14 are implemented across API and Admin UI. Work now lands feature by feature on `master`, one merge commit per feature, with the verification loop green at every commit.

**Known gaps, do not mistake for finished work:**

- Trash (spec 15): the `/admin/trash` screen ships and calls `/trash/*`, but the API module, the `trash_items` table and the OpenAPI paths do not exist. Implement the API or hide the nav entry; do not leave both states.
- Specs `02` and `08` are historical. For block authoring read `12`; for admin visuals read `09`.

## Workflow notes

- Significant architectural decisions get an ADR in `docs/adr/` (short: context, decision, consequences).
- When uncertain about a domain rule, check `docs/specs/` first, then ask; do not invent conventions.
- Parallel agent work uses one git worktree per feature. Remove the worktree and its branch after the merge; stale worktrees under `.claude/worktrees/` carry a full `node_modules` each.
