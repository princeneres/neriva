# Neriva: Phase A kickoff prompt

Paste everything below the line into Claude Code, in an empty directory containing only CLAUDE.md. Start in **plan mode** (Shift+Tab) so you approve the plan before any file is written.

---

Read CLAUDE.md carefully; it is the constitution of this project and every decision must comply with it.

We are starting **Phase A** of Neriva CMS: the walking skeleton. Do not implement feature modules (pages, blocks, content, objects, stylebook) yet; Phase A exists to freeze the conventions those modules will follow.

First produce a plan covering the steps below and wait for my approval. Then execute step by step, keeping the verification loop green after every step.

## Step 1: Repository foundation

- pnpm monorepo exactly as the architecture map in CLAUDE.md (apps/api, apps/web, packages/contracts, packages/ui, docs/).
- TypeScript strict, ESLint, Prettier, Vitest, root scripts: lint, typecheck, test, build.
- Docker Compose for local PostgreSQL 16. `.env.example` with all required vars.
- GitHub Actions CI running the full verification loop on every push.
- `docs/specs/00-skeleton.md`: a checklist spec of everything in this prompt; keep it updated as steps complete.

## Step 2: Entity envelope base (the heart of Neriva)

- Drizzle setup + migrations infrastructure.
- A reusable base for the standard entity envelope from CLAUDE.md (id UUIDv7, externalReferenceCode, tenantId, createdAt, updatedAt, createdBy, status, customFields JSONB), applied via shared column helpers, not inheritance magic.
- A generic repository/service pattern demonstrating: tenant-scoped queries (impossible to forget the tenant filter by construction), upsert by externalReferenceCode, cursor pagination.
- Seed machinery: on first boot create tenant "default", role "Administrator", user admin@neriva.com / admin with mustChangePassword=true.

## Step 3: Auth module

- Local email+password (argon2), JWT access + refresh tokens, login/refresh/logout endpoints.
- mustChangePassword enforcement: while true, every authenticated request except password-change and logout returns 403 with a problem+json explaining the required action.
- e2e tests covering the forced password change flow.

## Step 4: Users and Roles modules

- CRUD for users and roles through the standard envelope and response format.
- CASL ability factory building permissions from DB rows (role -> actions on resource types, tenant/site scope). Deny by default. A Nest guard + decorator (`@RequirePermission('page:create')` style) that feature modules will reuse.
- e2e tests proving a non-admin role is denied and admin is allowed.

## Step 5: Contracts and API conventions

- OpenAPI 3.1 spec generated from code decorators into docs/api/openapi.yaml, committed.
- packages/contracts exporting generated types consumed by apps/web.
- Standard success envelope { data, meta }, RFC 7807 errors, and URL id resolution (uuid or erc:<code></code>) implemented as global Nest infrastructure.

## Step 6: Web shell

- Next.js app with a minimal login screen + forced password change screen + empty authenticated admin shell (sidebar with placeholder nav for Sites, Pages, Content, Objects, Style Book, Users, Settings).
- Design tokens as CSS variables in packages/ui (primary #cc3d47, minimalist neutral palette); no component library lock-in decisions yet, tokens only.

## Step 7: README + docs

- Write the public README.md in the style of polished open source projects: logo placeholder, one-line pitch, badges, feature list, quickstart (docker compose up, default credentials admin@neriva.com / admin with forced change), architecture overview diagram, API-first section, roadmap, contributing, license (choose MIT unless I say otherwise).
- ADR-001 documenting the stack decision and ADR-002 documenting the entity envelope.

## Rules for this session

- Follow CLAUDE.md naming and conventions exactly; where this prompt and CLAUDE.md conflict, CLAUDE.md wins, tell me about the conflict.
- After each step: run the full verification loop, show me a summary of what changed and anything you decided that was not specified, then continue.
- If a library choice is ambiguous, pick the boring mainstream option and note it in the step summary.
- Do not implement anything from Phase B modules even if tempting.
