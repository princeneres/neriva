# Production image for Neriva. Two runtime targets share one build:
#   docker build --target api -t neriva-api .
#   docker build --target web -t neriva-web --build-arg NEXT_PUBLIC_API_URL=... .
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

# ---------------------------------------------------------------- api
FROM build AS api
WORKDIR /app/apps/api
ENV NODE_ENV=production
# Apply pending migrations on boot; the folder resolves from this workdir.
ENV RUN_MIGRATIONS=true
EXPOSE 3001
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------- web
FROM build AS webbuild
# Inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @neriva/web build

FROM webbuild AS web
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "--port", "3000"]
