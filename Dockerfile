# Production images for Neriva. Two runtime targets share one build:
#   docker build --target api -t neriva-api .
#   docker build --target web -t neriva-web --build-arg NEXT_PUBLIC_API_URL=... .
#
# Both runtime targets start from a clean node:22-bookworm-slim and copy only
# what the process needs, so no source tree, devDependency or build toolchain
# ships to a client. Both run as the unprivileged `node` user.
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @neriva/contracts build && pnpm --filter @neriva/api build

# Production-only dependency tree for the API. `pnpm deploy` flattens the
# workspace symlink farm into a plain node_modules that resolves on its own
# once copied out of this stage. --legacy is required from pnpm v10 for a
# workspace that does not inject its dependencies.
FROM build AS apideps
RUN pnpm --filter @neriva/api --prod --legacy deploy /deploy/api

# ---------------------------------------------------------------- api
FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
# Apply pending migrations on boot; the folder resolves from this workdir.
ENV RUN_MIGRATIONS=true
WORKDIR /app/apps/api
COPY --from=apideps --chown=node:node /deploy/api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
# Drizzle reads the SQL files and meta/_journal.json from ./drizzle at boot.
COPY --from=build --chown=node:node /app/apps/api/drizzle ./drizzle
# MEDIA_STORAGE_DIR points at /data/uploads in the production compose file,
# where a named volume is mounted. Docker seeds an empty volume from the image
# and copies the mount point's ownership, so the directory has to exist here
# owned by node; otherwise the volume lands as root and uploads fail with
# EACCES. ./uploads is the default when MEDIA_STORAGE_DIR is unset.
RUN install -d -m 0755 -o node -g node /data/uploads /app/apps/api/uploads
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------- web
FROM build AS webbuild
# Inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @neriva/web build
# next.config.ts sets output: 'standalone', so .next/standalone carries its own
# minimal node_modules and server.js. public/ is optional in this repo, and the
# COPY below needs it to exist.
RUN mkdir -p /app/apps/web/public

FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production
# Read by the standalone server; without HOSTNAME it binds the loopback only.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# The standalone bundle keeps the workspace layout, so the server ends up at
# /app/apps/web/server.js and expects static assets beside it.
COPY --from=webbuild --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=webbuild --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=webbuild --chown=node:node /app/apps/web/public ./apps/web/public
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
