<p align="center">
  <img src="docs/assets/logo.svg" alt="Neriva logo" width="96" height="96" />
</p>

<h1 align="center">Neriva</h1>

<p align="center"><strong>A lightweight, headless-first CMS that keeps the best ideas of enterprise portals without their weight.</strong></p>

<p align="center">
  <a href="https://github.com/neriva/neriva/actions"><img src="https://img.shields.io/badge/CI-passing-brightgreen" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-blue" alt="Node >= 20" />
  <img src="https://img.shields.io/badge/PostgreSQL-16%2B-336791" alt="PostgreSQL 16+" />
  <img src="https://img.shields.io/badge/license-MIT-black" alt="MIT license" />
</p>

Neriva takes the concepts that make Liferay DXP productive (pages composed from reusable fragments, structured web content, scoped roles and permissions, a style book of design tokens) and rebuilds them from scratch as a small, modern TypeScript stack. One Node container plus PostgreSQL is all it needs.

## Features

- **Headless-first.** Every capability of the Admin UI is available through the REST API. The Admin UI is just another API client, with no private backdoors.
- **Pages are data.** A Page is a JSON tree of Block instances with props, named slots and per-instance styles. The rendering runtime composes it; headless clients consume the raw JSON.
- **Authorable Blocks.** A Block declares a JSON schema of props plus named slots, and optionally an HTML + CSS template with editable-field bindings authored in the admin. Templates are data: interpolation is escaped and markup is sanitized on write, never executed server-side.
- **Master Pages and Page Templates.** A Master Page wraps every page that references it; a Page Template is a pre-filled starting point copied into a new page.
- **Structured content.** Content Types define fields; Content Entries hold the data, with client-defined fields stored as JSONB, never dynamic DDL.
- **Media library.** Uploaded images and documents in folders, with per-site defaults and public URLs.
- **Public delivery API.** PUBLISHED pages, content and site CSS served without authentication, for the built-in runtime or any headless consumer.
- **Scoped RBAC.** Roles grant actions on resource types, scoped to tenant or site, enforced with CASL and deny-by-default.
- **Style Book.** Versioned design tokens exposed as CSS variables, consumed by every Block.
- **Standard entity envelope.** UUIDv7 ids, external reference codes for idempotent upserts, tenant scoping in every query from day one.

## Running the project

### Prerequisites

- Node.js >= 20
- pnpm 10 (`corepack enable` is the easiest way to get it)
- Docker, only to run the API e2e suites (Testcontainers) or to develop against a production-like PostgreSQL

### Steps

```bash
git clone <repo-url> neriva && cd neriva
pnpm install
pnpm dev
```

That single command creates `.env` from `.env.example`, starts an embedded PostgreSQL 16 (data in `.neriva/pgdata`, port 5433), applies migrations, seeds the bootstrap and demo data, and runs the API on http://localhost:3001 alongside the Admin UI and rendering runtime on http://localhost:3000. Variants:

```bash
pnpm dev --no-demo    # bootstrap data only, no demo site
pnpm dev --db-only    # only the database, to run the apps yourself
```

Open http://localhost:3000. The root path serves the default site's published pages; the admin lives at http://localhost:3000/admin. Sign in with the bootstrap credentials: `admin@neriva.com` / `admin`. Neriva forces a password change on first login before anything else is allowed.

### Running against your own PostgreSQL

Set `DATABASE_URL` in `.env` and `pnpm dev` uses that server instead of the embedded one, waiting for it to accept connections before starting the apps. The bundled `docker-compose.yml` runs a matching PostgreSQL 16:

```bash
docker compose up -d
# .env: DATABASE_URL=postgres://neriva:neriva@localhost:5432/neriva
pnpm dev
```

Migrations run on boot outside production. In production they stay an explicit step: `pnpm --filter @neriva/api db:migrate`, or `RUN_MIGRATIONS=true` on the API process.

Published pages are reachable at `/<path>` for the default site and `/s/<site-slug>/<path>` for any other site.

To run the full verification loop (lint, typecheck, tests, build):

```bash
pnpm verify
```

## Architecture

```
apps/
  api/          NestJS + Fastify REST API. Modules: auth, users, roles, sites,
                pages, page-templates, blocks, content, objects, stylebook,
                media, delivery, system
  web/          Next.js admin UI (/admin) + public page rendering runtime
packages/
  contracts/    Types generated from the OpenAPI spec (single source)
  ui/           Design tokens as CSS variables
docs/
  specs/        One spec per feature (spec-driven development)
  api/          openapi.yaml, the API contract
  adr/          Architecture decision records
```

| Layer         | Choice                                                       |
| ------------- | ------------------------------------------------------------ |
| API           | NestJS on Fastify, TypeScript strict                         |
| Database      | PostgreSQL 16+, Drizzle ORM, JSONB for client-defined fields |
| Authorization | CASL abilities built from database rows, deny by default     |
| Admin UI      | Next.js App Router, Mantine v8 on Style Book tokens          |
| Tests         | Vitest, Testcontainers PostgreSQL for API e2e                |

## API-first

The OpenAPI 3.1 document at [`docs/api/openapi.yaml`](docs/api/openapi.yaml) is the contract and source of truth; it is generated from code, committed, and verified in CI. Conventions:

- Success responses use a `{ data, meta }` envelope.
- Errors are RFC 7807 `application/problem+json`.
- Lists paginate with cursors: `?limit=&cursor=` (default 20, max 100).
- URL ids accept a UUID or `erc:<externalReferenceCode>`.

The spec is generated from the code and verified in CI: `pnpm --filter @neriva/api openapi:generate` followed by `pnpm --filter @neriva/contracts generate` must leave no diff.

## Roadmap

- [x] Walking skeleton: entity envelope, auth, users, roles and permissions, API conventions, admin shell
- [x] Sites and Pages API (pages as JSON block trees, tree validation, publish flow)
- [x] Blocks API (JSON Schema props + named slots)
- [x] Content Types and Content Entries API
- [x] Objects API (client-defined entities over JSONB, dynamic filtering)
- [x] Style Book API (versioned design tokens, CSS endpoint)
- [x] System settings API (SMTP, site metadata)
- [x] Admin UI screens for the feature modules
- [x] Public delivery API and the page rendering runtime in apps/web
- [x] Media library (folders, uploads, public URLs)
- [x] Blocks v2: HTML + CSS templates, native component library, per-instance styles
- [x] Site-first navigation with a default site
- [x] Page Templates and Master Pages
- [ ] Trash (Recycle Bin): spec and admin UI done, API pending
- [ ] Workflow and scheduled publishing

## Contributing

1. Read `CLAUDE.md` (project constitution) and `docs/specs/`.
2. Spec before code: new features start as a spec in `docs/specs/` and a change to the OpenAPI contract.
3. Regenerate the contract after touching controllers or DTOs (see API-first above).
4. Keep the verification loop green: `pnpm verify`.
5. Conventional Commits.

## License

[MIT](LICENSE)
