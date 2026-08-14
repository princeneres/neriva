# Spec 00: Walking skeleton (Phase A)

Status: complete. Phase A is done; every box below is checked, which unlocks Phase B (parallel module work).

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
- [x] Default seeded role "Content Manager" (`content-manager`): full CRUD(+publish) on `page`, `content-entry`, `content-type`, `media`, `object-record`; read-only on `object-definition` and `block`; excludes `site`, `user`, `role`, `system-setting`, `style-book`, `page-template`

## Step 3: Auth module

- [x] Email+password login with argon2
- [x] JWT access + refresh tokens, login/refresh/logout endpoints
- [x] mustChangePassword enforcement (403 problem+json on everything except password change and logout)
- [x] e2e tests covering the forced password change flow

## Step 4: Users and Roles modules

- [x] Users CRUD through the standard envelope
- [x] Roles CRUD through the standard envelope
- [x] CASL ability factory from DB rows, deny by default
- [x] Permission guard + @RequirePermission decorator reusable by feature modules
- [x] e2e tests proving non-admin denied, admin allowed

## Step 5: Contracts and API conventions

- [x] OpenAPI 3.1 spec generated from decorators into docs/api/openapi.yaml, committed
- [x] packages/contracts exporting generated types consumed by apps/web
- [x] Success envelope { data, meta } as global infrastructure
- [x] RFC 7807 problem+json errors as global infrastructure
- [x] URL id resolution (uuid or erc:<code>) as global infrastructure

## Step 6: Web shell

- [x] Login screen
- [x] Forced password change screen
- [x] Empty authenticated admin shell with placeholder sidebar (Sites, Pages, Content, Objects, Style Book, Users, Settings)
- [x] Design tokens as CSS variables in packages/ui (primary #cc3d47, minimalist neutral palette)

## Step 7: README + docs

- [x] Public README (logo placeholder, pitch, badges, features, quickstart, architecture diagram, API-first section, roadmap, contributing, MIT license)
- [x] ADR-001: stack decision
- [x] ADR-002: entity envelope
