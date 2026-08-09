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
- **Pages are data.** A Page is a JSON tree of typed Block instances. The rendering runtime composes it; headless clients consume the raw JSON.
- **Typed Blocks, no template soup.** A Block declares a JSON schema of props and named slots. No string-template HTML editing.
- **Structured content.** Content Types define fields; Content Entries hold the data, with client-defined fields stored as JSONB, never dynamic DDL.
- **Scoped RBAC.** Roles grant actions on resource types, scoped to tenant or site, enforced with CASL and deny-by-default.
- **Style Book.** Versioned design tokens exposed as CSS variables, consumed by every Block.
- **Standard entity envelope.** UUIDv7 ids, external reference codes for idempotent upserts, tenant scoping in every query from day one.

## Quickstart

```bash
git clone <repo-url> neriva && cd neriva
pnpm install

# 1. Start PostgreSQL
docker compose up -d

# 2. Configure environment
cp .env.example .env

# 3. Apply database migrations
pnpm --filter @neriva/api db:migrate

# 4. Run the API and the Admin UI
pnpm --filter @neriva/api dev     # http://localhost:3001
pnpm --filter @neriva/web dev     # http://localhost:3000
```

Sign in with the bootstrap credentials: `admin@neriva.com` / `admin`. Neriva forces a password change on first login before anything else is allowed.

## Architecture

```
apps/
  api/          NestJS + Fastify REST API (auth, users, roles, system, ...)
  web/          Next.js admin UI + page rendering runtime
packages/
  contracts/    Types generated from the OpenAPI spec (single source)
  ui/           Shared components + design tokens
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
| Admin UI      | Next.js App Router, tokens-first styling                     |

## API-first

The OpenAPI 3.1 document at [`docs/api/openapi.yaml`](docs/api/openapi.yaml) is the contract and source of truth; it is generated from code, committed, and verified in CI. Conventions:

- Success responses use a `{ data, meta }` envelope.
- Errors are RFC 7807 `application/problem+json`.
- Lists paginate with cursors: `?limit=&cursor=` (default 20, max 100).
- URL ids accept a UUID or `erc:<externalReferenceCode>`.

## Roadmap

- [x] Walking skeleton: entity envelope, auth, users, roles and permissions, API conventions, admin shell
- [x] Sites and Pages API (pages as JSON block trees, tree validation, publish flow)
- [x] Blocks API (typed components: JSON Schema props + named slots)
- [x] Content Types and Content Entries API
- [x] Objects API (client-defined entities over JSONB, dynamic filtering)
- [x] Style Book API (versioned design tokens, CSS endpoint)
- [x] System settings API (SMTP, site metadata)
- [x] Admin UI screens for the feature modules
- [ ] Page rendering runtime in apps/web

## Contributing

1. Read `CLAUDE.md` (project constitution) and `docs/specs/`.
2. Spec before code: new features start as a spec in `docs/specs/` and a change to the OpenAPI contract.
3. Keep the verification loop green: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. Conventional Commits.

## License

[MIT](LICENSE)
