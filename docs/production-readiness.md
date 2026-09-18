# Production readiness checklist

This checklist is the launch gate for the Neriva v1 release candidate. A green
application build is necessary, but it is not sufficient for a public launch.

## Completed in the release-readiness pass

- Production authentication fails closed without a strong `JWT_ACCESS_SECRET`.
- Fresh production bootstrap requires `NERIVA_INITIAL_ADMIN_PASSWORD`.
- Production Docker Compose requires database, API, web origin, and public API
  configuration instead of using development fallbacks.
- Demo data is disabled by default in the production-shaped stack.
- `/health` is a liveness check and `/health/ready` verifies database readiness.
- Sensitive system-setting values are redacted from API responses.
- Non-raster public media is downloaded as an attachment and served with
  `X-Content-Type-Options: nosniff`.
- The incomplete Trash screen and navigation entry are hidden until its API is
  implemented.
- Published-site navigation is scoped to the current site.
- Native heading blocks preserve their configured semantic heading level.
- Public pages do not require Google Fonts access during a production build.
- The published-site theme toggle no longer double-toggles on checkbox clicks.
- Media uploads use an allowlist and verify the file signature before storage.
- Page, content-entry, and page-template editors support compare-and-set saves
  through `expectedUpdatedAt`, returning 409 instead of silently overwriting a
  newer edit.

## Required before public exposure

### Blockers

- Configure DNS for both public hostnames and deploy the included Caddy reverse
  proxy, or an equivalent managed TLS endpoint. Do not expose the container
  ports directly to the internet.
- Set unique production values for `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`,
  `NERIVA_INITIAL_ADMIN_PASSWORD`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, and
  `MEDIA_STORAGE_DIR`. Never use the example values.
- Create and test an automated PostgreSQL backup and restore procedure, with an
  owner, retention policy, RPO, and RTO.
- Run the complete e2e suite in a Docker-capable CI or staging environment.

### High priority

- Add structured logs, error tracking, metrics, and alerting for API errors,
  readiness failures, database pool exhaustion, and background work.
- Document migration, rollback, and deployment procedures. Migrations must be
  applied deliberately and verified before traffic is switched.
- Prefer serving user media from an isolated origin, even though public media
  is already restricted to safe inline raster types.
- Add resource-aware site context and enforce site-scoped permissions before
  exposing site-scoped grants. Until then, existing site-scoped rows fail
  closed and are never treated as tenant-wide.
- Require external editor clients to send `expectedUpdatedAt` before enabling
  concurrent editing workflows. The legacy omission remains backward-compatible
  for v1 API clients.

### Medium priority

- Add indexes or full-text search for public content queries and planned JSONB
  object filters. Avoid leading-wildcard scans as data grows.
- Configure explicit PostgreSQL pool limits and timeouts.
- Stream or otherwise bound multipart uploads and define total request limits.
- Replace fixed public cache expiry with publish-triggered invalidation where
  stale content is not acceptable.
- Add an explicit error state and retry action to admin list screens.

## Release candidate verification

Run the following from a Docker-capable host with the production environment
variables set:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose -f docker-compose.prod.yml up -d --build
```

Then verify `/health`, `/health/ready`, login with the rotated administrator
credential, an authenticated CRUD flow, publishing, anonymous delivery, media
download behavior, backup restore, and rollback. Keep the previous image and
database backup available until the new deployment has passed its smoke tests.

## Current verdict

The code is a release candidate for continued staging validation, not a public
production launch. The operational blockers above must be closed and the e2e
suite must pass in an environment with Docker before the first real users are
accepted.
