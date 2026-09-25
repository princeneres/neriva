# Deploying Neriva on one VM

The simplest production setup is one Linux VM running Docker Compose. The
production compose file starts PostgreSQL, the Neriva API, the Admin UI and a
Caddy reverse proxy. Caddy terminates HTTPS automatically, so only ports 80 and
443 need to be public. Node.js and pnpm are not required on the production VM.
For a no-cost VM, see [`deploy-oracle-cloud.md`](deploy-oracle-cloud.md).

## What the client receives

Each installation provides:

- an Admin UI at `https://cms.example.com/admin`;
- a public portal at `https://cms.example.com`;
- a public REST API at `https://api.example.com`;
- PostgreSQL data and media files stored in Docker volumes.

One installation can contain multiple Neriva Sites. For strict isolation
between customers, use one VM and one Compose project per customer. Neriva v1
is designed for this single-tenant deployment model.

## VM prerequisites

For a small portal, start with a Linux VM with at least 2 vCPUs, 4 GB RAM and
20 GB of disk, then size it from real traffic and media usage. The VM needs:

- Docker Engine and the Docker Compose v2 plugin;
- DNS A or AAAA records for the web and API hostnames;
- inbound TCP ports 80 and 443 open to the internet;
- SSH access for the person responsible for deployment and backups.

Do not expose ports 3000, 3001 or 5432 publicly. The included production
compose file keeps the application and database on the private Docker network.

## First installation

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
TRUST_PROXY=<docker-network-subnet, see "Client IP behind the proxy">
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

## Client IP behind the proxy

Caddy terminates the client connection, so by default every request reaches the
API from the proxy container address. The per-IP login rate limit then becomes
one global bucket, and a single caller locks every user out with ten requests a
minute. `TRUST_PROXY` fixes that: it lists the peers allowed to name the client
through `X-Forwarded-For`. Fastify walks that header from right to left and
stops at the first address outside the list, which is the entry Caddy appended
for the real client. Anything the caller forged sits further left and is
ignored, so the rate limiter and the request log both see the real address.

Keep the list as narrow as the proxy network. Never set `TRUST_PROXY=true` on a
reachable API: blanket trust lets any caller invent a new client IP on every
request, which defeats rate limiting more thoroughly than trusting no proxy at
all. Unset is the safe default and is what local development uses.

Read the subnet Compose created for the stack:

```bash
docker network inspect neriva_default \
  -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

Put that value in `.env` as `TRUST_PROXY`, and pass it to the API service in
`docker-compose.prod.yml` together with the log level:

```yaml
# services -> api -> environment
TRUST_PROXY: ${TRUST_PROXY:?set TRUST_PROXY}
LOG_LEVEL: ${LOG_LEVEL:-info}
```

Pinning the subnet in the compose file instead keeps the value stable across
`docker compose down`. In production the API writes one JSON line per request,
with the client IP and without credentials, authorization headers, cookies or
request bodies. Check it after the stack is up:

```bash
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=20 api
```

## Typical client workflow

The client does not need to edit code for normal portal work:

1. Create or select a Site under **Sites**.
2. Configure brand colors, typography and spacing in **Style Book**.
3. Create reusable **Blocks**, or use the built-in blocks.
4. Create a Page, arrange its blocks in Page Studio and publish it.
5. Add structured **Content** and upload assets in **Media**.
6. Consume published pages and content from the built-in runtime or any
   headless application through the REST API.

The API contract is available at
[`api/openapi.yaml`](api/openapi.yaml).

## Updating an installation

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

## Backups

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

## Operations and troubleshooting

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
[`production-readiness.md`](production-readiness.md).
