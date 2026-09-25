<div align="center">

<img src="docs/assets/logo.svg" alt="Neriva logo" width="96" height="96" />

# Neriva

**A lightweight, headless-first CMS that keeps the best ideas of enterprise portals without their weight.**

[![CI](https://github.com/princeneres/neriva/actions/workflows/ci.yml/badge.svg)](https://github.com/princeneres/neriva/actions/workflows/ci.yml)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL 16+](https://img.shields.io/badge/PostgreSQL-16%2B-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![NestJS](https://img.shields.io/badge/NestJS-Fastify-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)

[Features](#features) ·
[Screenshots](#screenshots) ·
[Quick start](#quick-start) ·
[Deployment](docs/deployment.md) ·
[API](docs/api/openapi.yaml)

<img src="docs/screenshots/page-studio.gif" alt="Editing a heading in Page Studio: the canvas updates live as the text and level change, then the page is saved" width="860" />

</div>

Neriva takes the concepts that make Liferay DXP productive (pages composed from reusable fragments, structured web
content, scoped roles and permissions, a style book of design tokens) and rebuilds them from scratch as a small,
modern TypeScript stack. One Node container plus PostgreSQL is all it needs.

## Features

- **Headless-first.** Every capability of the Admin UI is available through the REST API. The Admin UI is just
  another API client, with no private backdoors.
- **Pages are data.** A Page is a JSON tree of Block instances with props, named slots and per-instance styles. The
  rendering runtime composes it; headless clients consume the raw JSON.
- **Page Studio.** A visual editor to drag blocks onto a page, edit their props and styles, and preview desktop,
  tablet and mobile layouts before publishing.
- **Authorable Blocks.** A Block declares a JSON schema of props plus named slots, and optionally an HTML + CSS
  template with editable-field bindings authored in the admin. Templates are data: interpolation is escaped and
  markup is sanitized on write, never executed server-side.
- **Master Pages and Page Templates.** A Master Page wraps every page that references it; a Page Template is a
  pre-filled starting point copied into a new page.
- **Structured content.** Content Types define fields; Content Entries hold the data, with client-defined fields
  stored as JSONB, never dynamic DDL.
- **Objects.** Define your own data tables as metadata (typed fields, validation, dynamic filtering) without
  writing a migration.
- **Media library.** Uploaded images and documents in folders, with per-site defaults and public URLs.
- **Public delivery API.** Published pages, content and site CSS served without authentication, for the built-in
  runtime or any headless consumer.
- **Scoped RBAC.** Roles grant actions on resource types, scoped to tenant or site, enforced with CASL and
  deny-by-default.
- **Style Book.** Versioned design tokens exposed as CSS variables, consumed by every Block.
- **Standard entity envelope.** UUIDv7 ids, external reference codes for idempotent upserts, tenant scoping in
  every query from day one.

## Screenshots

![Page Studio: block palette, the page canvas with a selected heading, and its properties panel](docs/screenshots/page-studio.png)

| Block editor                                                                               | Blocks library                                                                      |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| ![HTML, CSS and JavaScript editors with a live preview](docs/screenshots/block-editor.png) | ![Library of layout, basic and content blocks](docs/screenshots/blocks.png)         |
| **Pages**                                                                                  | **Published site**                                                                  |
| ![Page tree with publish status](docs/screenshots/pages.png)                               | ![Public blog page rendered from content entries](docs/screenshots/public-site.png) |

<details>
<summary><strong>More screens</strong></summary>

| Content types                                             | Objects                                              |
| --------------------------------------------------------- | ---------------------------------------------------- |
| ![Content types list](docs/screenshots/content-types.png) | ![Objects list](docs/screenshots/objects.png)        |
| **Style Book**                                            | **Roles**                                            |
| ![Versioned style books](docs/screenshots/style-book.png) | ![Roles and permissions](docs/screenshots/roles.png) |
| **Media library**                                         | **Sign in**                                          |
| ![Media library with folders](docs/screenshots/media.png) | ![Sign-in screen](docs/screenshots/login.png)        |

![Tour of the admin: pages, Page Studio with responsive previews, the block code editor and the published site](docs/screenshots/tour.gif)

</details>

> The screenshots show the demo site that `pnpm dev` seeds on first run.

## Quick start

**Prerequisites:** Node.js 20+ and pnpm 10 (`corepack enable` is the easiest way to get it). Docker is needed only
for the API end-to-end suites (Testcontainers) or to develop against a production-like PostgreSQL.

```bash
git clone https://github.com/princeneres/neriva.git && cd neriva
pnpm install
pnpm dev
```

That single command creates `.env` from `.env.example`, starts an embedded PostgreSQL 16 (data in
`.neriva/pgdata`, port 5433), applies migrations, seeds the bootstrap and demo data, and runs:

| URL                         | What                                             |
| --------------------------- | ------------------------------------------------ |
| http://localhost:3000       | Public site (the default site's published pages) |
| http://localhost:3000/admin | Admin UI                                         |
| http://localhost:3001       | REST API                                         |

Sign in as `admin@neriva.com` with the password set in `NERIVA_INITIAL_ADMIN_PASSWORD` in `.env`
(`change-me-before-production` when `.env` was just created from the example). Neriva forces a password change on
first login.

Variants:

```bash
pnpm dev --no-demo    # bootstrap data only, no demo site
pnpm dev --db-only    # only the database, to run the apps yourself
```

Published pages are reachable at `/<path>` for the default site and `/s/<site-slug>/<path>` for any other site.

### Running against your own PostgreSQL

Set `DATABASE_URL` in `.env` and `pnpm dev` uses that server instead of the embedded one. The bundled
`docker-compose.yml` runs a matching PostgreSQL 16:

```bash
docker compose up -d
# .env: DATABASE_URL=postgres://neriva:neriva@localhost:5432/neriva
pnpm dev
```

Migrations run on boot outside production. In production they stay an explicit step:
`pnpm --filter @neriva/api db:migrate`, or `RUN_MIGRATIONS=true` on the API process.

### Verification loop

```bash
pnpm verify    # lint, typecheck, tests and build
```

## Deployment

The simplest production setup is one Linux VM running Docker Compose: PostgreSQL, the API, the Admin UI and a
Caddy reverse proxy with automatic HTTPS. Only ports 80 and 443 are public, and Node.js is not needed on the VM.

- [Deploying Neriva on one VM](docs/deployment.md): first install, environment, client IP behind the proxy,
  updates, backups and troubleshooting
- [Oracle Cloud Always Free](docs/deploy-oracle-cloud.md): running an installation at no cost
- [Production readiness](docs/production-readiness.md): monitoring, rollback, RPO/RTO and the release checklist

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

Design decisions are recorded in [`docs/adr/`](docs/adr) and every feature has a spec in
[`docs/specs/`](docs/specs).

## API-first

The OpenAPI 3.1 document at [`docs/api/openapi.yaml`](docs/api/openapi.yaml) is the contract and source of truth;
it is generated from code, committed, and verified in CI. Conventions:

- Success responses use a `{ data, meta }` envelope.
- Errors are RFC 7807 `application/problem+json`.
- Lists paginate with cursors: `?limit=&cursor=` (default 20, max 100).
- URL ids accept a UUID or `erc:<externalReferenceCode>`.

After touching controllers or DTOs, run `pnpm --filter @neriva/api openapi:generate` followed by
`pnpm --filter @neriva/contracts generate`; CI requires both to leave no diff.

## Roadmap

- [x] Walking skeleton: entity envelope, auth, users, roles and permissions, API conventions, admin shell
- [x] Sites and Pages API (pages as JSON block trees, tree validation, publish flow)
- [x] Blocks API (JSON Schema props + named slots)
- [x] Content Types and Content Entries API
- [x] Objects API (client-defined entities over JSONB, dynamic filtering)
- [x] Style Book API (versioned design tokens, CSS endpoint)
- [x] System settings API (typed catalog of known settings, free-form keys, redacted secrets)
- [x] Admin UI screens for the feature modules
- [x] Public delivery API and the page rendering runtime in apps/web
- [x] Media library (folders, uploads, public URLs)
- [x] Blocks v2: HTML + CSS templates, native component library, per-instance styles
- [x] Site-first navigation with a default site
- [x] Page Templates and Master Pages
- [ ] Trash (Recycle Bin): spec and admin UI done, API pending
- [ ] Email delivery: SMTP settings are stored but nothing sends mail yet
- [ ] Workflow and scheduled publishing

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and report vulnerabilities privately as
described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
