# Spec 00: Walking skeleton (Phase A)

Status: in progress. This checklist is the gate for Phase B; every box must be checked before parallel module work starts. Kept updated as steps complete.

## Step 1: Repository foundation

- [x] pnpm monorepo matching the architecture map (apps/api, apps/web, packages/contracts, packages/ui, docs/)
- [x] TypeScript strict everywhere, ESLint (flat config), Prettier
- [x] Vitest wired in every package
- [x] Root scripts: lint, typecheck, test, build (plus verify running the full loop)
- [x] Docker Compose for local PostgreSQL 16
- [x] .env.example with all required vars
- [x] GitHub Actions CI running the full verification loop on every push
- [x] This checklist spec created and maintained

## Step 2: Entity envelope base

- [x] Drizzle setup + migrations infrastructure
- [x] Shared column helpers for the standard entity envelope (id UUIDv7, externalReferenceCode, tenantId, createdAt, updatedAt, createdBy, status, customFields JSONB)
- [x] Generic repository/service pattern: tenant-scoped queries by construction
- [x] Upsert by externalReferenceCode
- [x] Cursor pagination (?limit=&cursor=, default 20, max 100)
- [x] First-boot seed: tenant "default", role "Administrator", admin@neriva.com / admin with mustChangePassword=true

## Step 3: Auth module

- [x] Email+password login with argon2
- [x] JWT access + refresh tokens, login/refresh/logout endpoints
- [x] mustChangePassword enforcement (403 problem+json on everything except password change and logout)
- [x] e2e tests covering the forced password change flow

## Step 4: Users and Roles modules

- [ ] Users CRUD through the standard envelope
- [ ] Roles CRUD through the standard envelope
- [ ] CASL ability factory from DB rows, deny by default
- [ ] Permission guard + @RequirePermission decorator reusable by feature modules
- [ ] e2e tests proving non-admin denied, admin allowed

## Step 5: Contracts and API conventions

- [ ] OpenAPI 3.1 spec generated from decorators into docs/api/openapi.yaml, committed
- [ ] packages/contracts exporting generated types consumed by apps/web
- [ ] Success envelope { data, meta } as global infrastructure
- [ ] RFC 7807 problem+json errors as global infrastructure
- [ ] URL id resolution (uuid or erc:<code>) as global infrastructure

## Step 6: Web shell

- [ ] Login screen
- [ ] Forced password change screen
- [ ] Empty authenticated admin shell with placeholder sidebar (Sites, Pages, Content, Objects, Style Book, Users, Settings)
- [ ] Design tokens as CSS variables in packages/ui (primary #cc3d47, minimalist neutral palette)

## Step 7: README + docs

- [ ] Public README (logo placeholder, pitch, badges, features, quickstart, architecture diagram, API-first section, roadmap, contributing, MIT license)
- [ ] ADR-001: stack decision
- [ ] ADR-002: entity envelope
