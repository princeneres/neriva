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

## Running locally

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

## Deploying a client portal on one VM

The simplest production setup is one Linux VM running Docker Compose. The
production compose file starts PostgreSQL, the Neriva API, the Admin UI and a
Caddy reverse proxy. Caddy terminates HTTPS automatically, so only ports 80 and
443 need to be public. Node.js and pnpm are not required on the production VM.

### What the client receives

Each installation provides:

- an Admin UI at `https://cms.example.com/admin`;
- a public portal at `https://cms.example.com`;
- a public REST API at `https://api.example.com`;
- PostgreSQL data and media files stored in Docker volumes.

One installation can contain multiple Neriva Sites. For strict isolation
between customers, use one VM and one Compose project per customer. Neriva v1
is designed for this single-tenant deployment model.

### VM prerequisites

For a small portal, start with a Linux VM with at least 2 vCPUs, 4 GB RAM and
20 GB of disk, then size it from real traffic and media usage. The VM needs:

- Docker Engine and the Docker Compose v2 plugin;
- DNS A or AAAA records for the web and API hostnames;
- inbound TCP ports 80 and 443 open to the internet;
- SSH access for the person responsible for deployment and backups.

Do not expose ports 3000, 3001 or 5432 publicly. The included production
compose file keeps the application and database on the private Docker network.

### First installation

1. Point the DNS records at the VM. For example:

   - `cms.example.com` -> the VM public IP;
   - `api.example.com` -> the VM public IP.

2. Install Docker on the VM using the official Docker instructions, then clone
   the repository:

```bash
sudo mkdir -p /opt/neriva
sudo chown "$USER":"$USER" /opt/neriva
git clone <repo-url> /opt/neriva
cd /opt/neriva
```

3. Create the production environment file:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -base64 24
```

Edit `.env` and replace the example values. The hostnames do not include
`https://`:

```dotenv
WEB_HOST=cms.example.com
API_HOST=api.example.com
WEB_ORIGIN=https://cms.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
POSTGRES_PASSWORD=<unique-database-password>
JWT_ACCESS_SECRET=<random-value-at-least-32-characters>
NERIVA_INITIAL_ADMIN_PASSWORD=<temporary-password-at-least-15-characters>
```

The initial administrator is `admin@neriva.com`. The password above is read
only when the database is created for the first time. Change it immediately
after the first login. Demo content is disabled in the production compose
file.

4. Start the stack:

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
```

On the first start, the API applies the database migrations and seeds the
bootstrap tenant, roles and administrator. Caddy requests certificates after
DNS is resolving and ports 80/443 are reachable. Verify the installation:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/health/ready
curl -I https://cms.example.com
```

Open `https://cms.example.com/admin`, sign in, change the administrator
password, create the client Site and publish its first Page.

### Typical client workflow

The client does not need to edit code for normal portal work:

1. Create or select a Site under **Sites**.
2. Configure brand colors, typography and spacing in **Style Book**.
3. Create reusable **Blocks**, or use the built-in blocks.
4. Create a Page, arrange its blocks in Page Studio and publish it.
5. Add structured **Content** and upload assets in **Media**.
6. Consume published pages and content from the built-in runtime or any
   headless application through the REST API.

The API contract is available at
[`docs/api/openapi.yaml`](docs/api/openapi.yaml).

### Updating an installation

Keep the current release reference and a database backup before updating. From
the application directory:

```bash
git fetch --tags
git checkout <release-ref>
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
curl -fsS https://api.example.com/health/ready
```

Keep the previous image available until the smoke checks pass. If a release
needs to be rolled back, deploy the previous release reference and restore the
database backup if the migration is not backward-compatible. Test rollback in
staging before using it on the client portal.

### Backups

Docker volumes are persistent storage, not a backup policy. Take a consistent
database backup and copy the media volume to storage outside the VM. Pause
content editing during the copy or use a maintenance window:

```bash
mkdir -p backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

docker compose --env-file .env -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U neriva -d neriva | gzip > "backups/neriva-db-$STAMP.sql.gz"

docker compose --env-file .env -f docker-compose.prod.yml cp \
  api:/data/uploads "backups/neriva-media-$STAMP"
```

Copy both backup artifacts to a separate machine or object store, retain more
than one generation, and perform a restore drill before accepting production
traffic. Restore database and media from the same snapshot. Do not test a
restore over the live database without a verified backup and a maintenance
plan.

### Operations and troubleshooting

```bash
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=200 api
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=200 web
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=200 proxy
```

If `/health/ready` fails, check the API logs and PostgreSQL health first. If
HTTPS certificates are not issued, verify DNS, firewall rules and that Caddy
can receive connections on both ports 80 and 443. Never solve an outage by
publishing PostgreSQL or the API directly to the internet.

For the remaining launch controls, including monitoring, rollback ownership,
backup RPO/RTO and the release checklist, see
[`docs/production-readiness.md`](docs/production-readiness.md).

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
