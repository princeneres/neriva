# Deploying on Oracle Cloud Always Free

This guide runs one Neriva installation at no cost on an Oracle Cloud
Infrastructure (OCI) Always Free ARM VM. It covers only the OCI-specific steps.
The application setup itself (`.env`, first start, updates, backups) is the
generic single-VM flow described in
[Deploying Neriva on one VM](deployment.md).

Always Free fits Neriva well: the production compose file needs one VM with a
persistent disk, because PostgreSQL and the media library both live in Docker
volumes. Platforms whose free tier has an ephemeral filesystem would lose every
uploaded media file on restart.

## What Always Free gives you

- Ampere A1 (ARM64) compute: 4 OCPUs and 24 GB of RAM in total, which can be
  one VM or split across several.
- 200 GB of block storage in total, boot volumes included, plus 5 volume
  backups.
- 10 TB of outbound traffic per month.
- 20 GB of Object Storage, useful as an offsite target for backups.

Neriva runs comfortably on 2 OCPUs and 12 GB, which leaves room for a staging
VM with the remaining quota.

## Caveats before you start

- **Card verification.** Sign-up asks for a credit card. Always Free resources
  are not charged.
- **The home region is permanent.** Always Free compute only runs in the home
  region chosen at sign-up. Popular regions often report `Out of capacity` for
  A1 shapes. Retry later, try another availability domain, or pick a less busy
  region when signing up.
- **Idle reclamation.** Oracle may stop Always Free instances that stay idle
  for 7 days (CPU, network and, on A1, memory usage all under 20%). A low
  traffic CMS can qualify. Upgrading the account to Pay As You Go removes this
  policy and keeps Always Free resources free. If you upgrade, create a budget
  with an alert at a small amount so any accidental paid resource is noticed.

## 1. Create the VM

In the OCI console:

1. **Networking > Virtual Cloud Networks > Start VCN Wizard**, choose
   _Create VCN with Internet Connectivity_ and accept the defaults.
2. **Compute > Instances > Create instance**:
   - Image: _Canonical Ubuntu 24.04_ (the aarch64 build is selected
     automatically for A1).
   - Shape: _Ampere > VM.Standard.A1.Flex_, 2 OCPUs, 12 GB memory.
   - Networking: the public subnet created by the wizard, with _Assign a public
     IPv4 address_ enabled.
   - SSH keys: upload your public key.
   - Boot volume: set a custom size, for example 100 GB.
3. Note the instance public IP. It stays assigned across stop and start, and is
   released only when the instance is terminated.

Connect with `ssh ubuntu@<public-ip>`.

## 2. Open ports 80 and 443

OCI filters traffic in two places, and both need the ports open.

**Security list.** In the VCN, open the public subnet's default security list
and add ingress rules with source `0.0.0.0/0`:

| Protocol | Destination port | Purpose                         |
| -------- | ---------------- | ------------------------------- |
| TCP      | 80               | HTTP and ACME certificate check |
| TCP      | 443              | HTTPS                           |
| UDP      | 443              | HTTP/3 (optional)               |

Leave port 22 as the wizard created it. Never add 3000, 3001 or 5432.

**Host firewall.** OCI Ubuntu images ship iptables rules that reject every
inbound port except SSH. Allow the web ports and persist the change:

```bash
sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT
sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
```

Log out and back in so the group applies, then check with `docker compose
version`. Installing Docker after the firewall change matters: Docker inserts
its forwarding rules ahead of the image's reject rules when it starts. If you
change iptables again later, run `sudo systemctl restart docker` afterwards.

The Neriva images build from `node:22-bookworm-slim` and `postgres:16-alpine`,
both of which publish ARM64 variants, so the build runs natively on the VM.

## 4. Point two hostnames at the VM

Caddy needs a web hostname and an API hostname resolving to the public IP
before it can obtain certificates.

- **Own domain:** create two A records, for example `cms.example.com` and
  `api.example.com`. On Cloudflare, keep them _DNS only_ (grey cloud) at least
  until the first certificates are issued.
- **No domain yet:** create two free subdomains on [DuckDNS](https://www.duckdns.org),
  for example `neriva-cms.duckdns.org` and `neriva-api.duckdns.org`, both
  pointing at the public IP. Let's Encrypt issues certificates for them
  normally.

Check resolution from your machine with `dig +short <hostname>`.

## 5. Install Neriva

Follow the README from
[First installation](deployment.md#first-installation), step 2 onwards: clone
into `/opt/neriva`, create `.env`, then:

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

Notes specific to this setup:

- The first build takes several minutes on 2 OCPUs.
- `TRUST_PROXY` can stay unset in `.env`. The production compose file pins the
  Docker network to `172.28.0.0/16` and uses that as the default.
- If the proxy logs show certificate errors, recheck step 2 (both filters) and
  step 4 (DNS), then `docker compose -f docker-compose.prod.yml restart proxy`.

Verify from outside the VM:

```bash
curl -fsS https://<api-host>/health/ready
curl -I https://<web-host>
```

## 6. Schedule backups

Volumes on one VM are not a backup. Save this as `/opt/neriva/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/neriva
COMPOSE="docker compose --env-file .env -f docker-compose.prod.yml"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups

$COMPOSE exec -T postgres pg_dump -U neriva -d neriva | gzip > "backups/neriva-db-$STAMP.sql.gz"
$COMPOSE cp api:/data/uploads "backups/neriva-media-$STAMP"
tar -czf "backups/neriva-media-$STAMP.tar.gz" -C backups "neriva-media-$STAMP"
rm -rf "backups/neriva-media-$STAMP"

find backups -name 'neriva-*' -mtime +7 -delete
```

Make it executable and run it nightly:

```bash
chmod +x /opt/neriva/backup.sh
(crontab -l 2>/dev/null; echo '30 3 * * * /opt/neriva/backup.sh >> /opt/neriva/backups/backup.log 2>&1') | crontab -
```

These files still live on the VM. Copy them offsite, for example to an OCI
Object Storage bucket through its S3-compatible endpoint with `rclone`, or to
any other machine. As a second layer, enable a boot volume backup policy in the
console; Always Free includes 5 volume backups. Run a restore drill once before
relying on either.
