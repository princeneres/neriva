# ADR-004: One-command development bootstrap with an embedded PostgreSQL

## Status

Accepted.

## Context

Getting Neriva running locally took four steps and one manual file copy: start the
docker-compose PostgreSQL, copy `.env.example` to `.env`, apply migrations, then run
the API and the web app in two terminals. Docker was a hard prerequisite for the
simplest case, "clone the repo and look at the CMS".

That is a poor first impression for a project whose selling point is that it runs on
modest infrastructure. Liferay solves the same problem by shipping an embedded
HSQLDB for evaluation and a real database for anything serious. We want the same
split without giving up PostgreSQL: the data layer relies on JSONB, cursor
pagination over real SQL, and Kysely-built dynamic queries in the objects module, so
swapping the engine for evaluation would mean the demo path exercises different SQL
than production.

Options considered:

1. **`embedded-postgres`**: real PostgreSQL binaries, downloaded as an optional
   platform dependency and run as a child process. No change to Drizzle, Kysely or
   the `pg` pool. Costs a one-time binary download at install and 1 to 3 seconds of
   startup.
2. **PGlite**: PostgreSQL compiled to WebAssembly, running in-process. Starts in
   milliseconds and needs no binaries, but changes `Database` to a different Drizzle
   driver type, has a single connection instead of a pool, and would need a
   community Kysely dialect for the objects module.
3. **Keep Docker, add orchestration only**: one command, but Docker stays a
   prerequisite.

## Decision

Add a root `pnpm dev` (`scripts/dev.mjs`) that resolves a database, then runs the
API and the web app side by side with prefixed logs.

Database resolution is explicit-config-wins:

- `DATABASE_URL` set (environment or `.env`) uses that server, and the script waits
  for it to accept connections before starting the apps.
- `DATABASE_URL` unset starts an embedded PostgreSQL 16 cluster (option 1) with its
  data in `.neriva/pgdata`, on port 5433 so it can coexist with the docker-compose
  cluster on 5432.

`.env.example` ships with `DATABASE_URL` commented out, so a fresh clone gets the
embedded path. The script copies `.env.example` to `.env` when `.env` is missing.

Migrations move into the API boot path outside production: `RUN_MIGRATIONS` now
defaults to true unless `NODE_ENV=production`, and `RUN_MIGRATIONS=false` opts out
anywhere. Seeds already ran on bootstrap. The separate migrate step disappears from
the development flow while production keeps migrations an explicit, opt-in step.

The API dev server switches to the SWC builder (`nest-cli.json`, `builder: "swc"`)
for faster boots and rebuilds. Type checking is left to `pnpm typecheck` in the
verification loop, which is where it was already enforced. The production build
(`tsc -p tsconfig.build.json`) is unchanged, so the shipped artifact is still
type-checked by the TypeScript compiler.

`docker-compose.yml` stays as the production-like option and Testcontainers keeps
using Docker for the API e2e suites, unchanged.

## Consequences

- A fresh clone runs with `pnpm install && pnpm dev`. Docker is needed only for the
  e2e suites and for running against a production-like database.
- Installing pulls a platform-specific PostgreSQL binary (about 50 to 100 MB) as an
  optional dependency. The platform packages are listed in `onlyBuiltDependencies`
  because their postinstall step hydrates the binaries.
- The embedded cluster is real PostgreSQL 16, the same major version as
  docker-compose, so the evaluation path and the production path run identical SQL.
  This is the property option 2 would have given up.
- `embedded-postgres` publishes every release under a `-beta` prerelease tag; the
  version is pinned exactly rather than range-matched. It is a development-only
  dependency and never runs in a deployed environment.
- Existing checkouts keep their current behaviour: their `.env` already sets
  `DATABASE_URL`, so they stay on docker-compose until they comment that line out.
- The SWC builder does not type-check on save. Type errors surface in the editor and
  in `pnpm typecheck`, not in the dev server output.
