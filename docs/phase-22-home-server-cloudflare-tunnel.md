# Phase 22: Home Server + Cloudflare Tunnel

## Goal

Run PokeDad Radar privately on a computer you own with Docker Compose and a remotely managed Cloudflare Tunnel. The deployment exposes one authenticated HTTPS application while PostgreSQL, Redis, and the API remain private inside Docker.

## Architecture

```text
Phone / Browser
  -> HTTPS https://pokedad.example.com
  -> Cloudflare and optional Cloudflare Access
  -> outbound Cloudflare Tunnel
  -> Home Server Docker network
       -> nginx web container (SPA and /api reverse proxy)
       -> Fastify API container
       -> PostgreSQL container
       -> Redis container
```

No router port forwarding is required. `cloudflared` makes an outbound connection. The tunnel publishes only `http://web:80`; PostgreSQL, Redis, and the API have no host or public ports. PokeDad Radar login remains required even if Cloudflare Access is enabled.

## Recommended URL Strategy

Use the single-domain route:

```text
https://pokedad.example.com
https://pokedad.example.com/api/*
```

nginx serves the SPA and removes `/api` while proxying to `http://api:4000`. This avoids cross-origin browser configuration and uses same-origin secure cookies. A split domain is supported conceptually, but adds CORS and cookie complexity without benefit for this private deployment.

## Requirements

- A Cloudflare-managed domain.
- A Cloudflare remotely managed tunnel and token.
- Docker Desktop on Windows, or Docker Engine plus Compose v2 on Linux.
- A server that remains powered on and does not sleep.
- Secure storage for environment files, the stable encryption key, and backups.

## Environment and Secrets

Copy, then edit locally on the server:

```powershell
Copy-Item .env.home-server.example .env.home-server
Copy-Item apps/api/.env.home-server.example apps/api/.env.home-server
Copy-Item apps/web/.env.home-server.example apps/web/.env.home-server
```

Generate a long random `SESSION_SECRET`, a strong PostgreSQL password, and an exactly 32-character stable `ENCRYPTION_KEY`. Back up the encryption key separately: losing it can make encrypted Discord alert credentials unreadable. Never commit real env files or paste secrets into logs, tickets, or chat.

The `DATABASE_URL` password must match `POSTGRES_PASSWORD`. Keep `DATABASE_URL=...@postgres:5432/...` and `REDIS_URL=redis://redis:6379`; these are Docker service names, not public hosts.

## Cloudflare Tunnel

1. In Cloudflare Zero Trust, create a remotely managed tunnel.
2. Add a public hostname such as `pokedad.example.com`.
3. Set its service to `http://web:80`. This name resolves inside the Compose network.
4. Copy only the tunnel token into `CLOUDFLARE_TUNNEL_TOKEN` in `.env.home-server`.
5. Do not configure routes to `postgres`, `redis`, or `api`.

The Compose service uses the official `cloudflare/cloudflared:latest` image and `tunnel --no-autoupdate run --token ...`. Docker image updates are handled during deliberate deployments.

## Discord OAuth Production Redirect

For the single-domain route, register this exact URI in the Discord Developer Portal:

```text
https://pokedad.example.com/api/discord/oauth/callback
```

Set the same value in `DISCORD_REDIRECT_URI`, set `PUBLIC_APP_URL` and `WEB_ORIGIN` to the HTTPS application origin, restart the API, reconnect Discord, and send a test alert. Access and refresh tokens remain discarded; the webhook remains encrypted.

Split-domain alternative: `https://api.pokedad.example.com/discord/oauth/callback`. It requires a second tunnel hostname and matching CORS configuration, so it is not recommended here.

## Windows Home Server

1. Install Docker Desktop with WSL2 and enable start on login.
2. Disable sleep and hibernation; keep the server plugged in.
3. Decide how Docker starts after reboot. Interactive Docker Desktop normally needs a user login; auto-login is optional and has security tradeoffs.
4. Schedule Windows updates and verify containers after reboots.
5. Allow outbound HTTPS/DNS traffic for Cloudflare. No inbound router rule is needed.
6. Keep the backup folder on protected storage. A UPS is useful but optional.
7. A static LAN IP is optional and is not required by Cloudflare Tunnel.
8. Do not expose PostgreSQL or Redis to the LAN or Internet.

Setup and operation:

```powershell
.\scripts\home-server-setup.ps1
.\scripts\home-server-check.ps1
.\scripts\home-server-backup.ps1
.\scripts\home-server-stop.ps1
.\scripts\home-server-start.ps1
```

## Linux Home Server

Install Docker Engine and the Compose plugin from the distribution/vendor-supported packages. Add the deployment user to the Docker group only if that trust level is acceptable, enable Docker at boot, and run:

```bash
chmod +x scripts/home-server-*.sh
./scripts/home-server-setup.sh
./scripts/home-server-check.sh
```

Use systemd to enable Docker. Compose services use `restart: unless-stopped`, so they return after Docker starts. Keep env files readable only by the deployment account (`chmod 600`).

## Deploy and Update Runbook

1. Run a backup before every update.
2. Pull or copy the reviewed application changes.
3. Run `npm run security:check`.
4. Run the setup script, which validates Compose, builds images, starts data services, runs `prisma migrate deploy`, and starts the stack.
5. Run the check script and verify the public HTTPS page, login, Discord status, Notification History, and scheduler state.
6. Keep the Best Buy scheduler stopped unless official approval, configuration, and the controlled readiness process are complete.

Rollback by restoring the prior reviewed code/image version and running Compose again. Database migrations are forward deployments; take a backup first and never use `migrate reset` in production.

## Backup and Restore

Create a backup before updates and daily:

```powershell
.\scripts\home-server-backup.ps1
```

Restore only during a planned maintenance window:

```powershell
.\scripts\restore-db.ps1 -ComposeFile docker-compose.home-server.yml -InputPath backups\home-server\pokedad-example.sql
```

Keep at least 7 daily and 4 weekly backups, copy them to encrypted storage off the server, and test a restore periodically. Database backups do not replace the separately protected `ENCRYPTION_KEY`.

Example Windows Task Scheduler creation (run from an elevated prompt and adjust paths/account):

```powershell
schtasks /Create /SC DAILY /ST 03:00 /TN "PokeDad Radar Backup" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\path\to\poke-dad-radar\scripts\home-server-backup.ps1" /F
```

## Health and Monitoring

Run `scripts/home-server-check.ps1` regularly. Monitor:

- all five containers and their health status;
- internal `/api/health` through nginx;
- PostgreSQL and Redis health;
- public dashboard and authenticated login;
- Discord connection/delivery failures;
- Best Buy scheduler status (stopped unless intentionally approved);
- disk space and latest backup timestamp;
- Cloudflare tunnel status in Zero Trust.

## Optional Cloudflare Access

Cloudflare Access is recommended as an extra outer gate. Create a self-hosted application for `pokedad.example.com` and an allow policy for your email or identity provider. Keep the PokeDad Radar login enabled: Access supplements application authentication and does not replace it. Ensure the Discord OAuth callback can complete under the chosen Access policy; test the full connect flow after enabling it.

## Security Checklist

- HTTPS only at the public hostname.
- Secure, HttpOnly, SameSite cookies in production.
- CORS restricted to `PUBLIC_APP_URL`/`WEB_ORIGIN`.
- Strong admin password and login throttling.
- No stack traces or secrets in production responses/logs.
- No published API, PostgreSQL, or Redis ports in the home-server Compose file.
- Run `npm run security:check` before deployment.
- Protect env files and backups; preserve the stable encryption key.
- Dashboard login is always required.

## Troubleshooting

- **Tunnel offline:** verify Docker, `cloudflared` logs, outbound connectivity, and token configuration without printing the token.
- **502 from Cloudflare:** public hostname service must be `http://web:80`; inspect web/API health inside Compose.
- **API 404:** use `/api/...` publicly. nginx strips the prefix internally.
- **Discord invalid redirect:** the Developer Portal URI and `DISCORD_REDIRECT_URI` must match exactly, including `/api` and HTTPS.
- **Database authentication error:** make `POSTGRES_PASSWORD` and the password in `DATABASE_URL` identical before first startup.
- **Encrypted alert config unreadable:** restore the original stable `ENCRYPTION_KEY`; do not rotate it casually.
- **Docker does not return after reboot:** verify Docker auto-start and that a Windows user session starts Docker Desktop, or use a Linux Docker service.

## Safety Policy

This deployment remains private-use-first and manual/open-only for retailer actions. It adds no scanning, scraping, cart, checkout, auto-purchase, browser automation, retailer credentials/sessions/cookies, payment data, CAPTCHA/queue bypass, or purchase-limit bypass. Future retailer access requires an approved official read-only API pathway.

## ngrok Alternative

The same single-domain routing can use the official ngrok container instead of Cloudflare Tunnel. The configured free domain is:

```text
https://flavored-flint-hardcore.ngrok-free.dev
```

Use `docker-compose.home-server.yml` with `docker-compose.ngrok.yml`; the override disables `cloudflared` by default and sends ngrok only to `http://web:80`. See `docs/ngrok-home-server-deployment.md` for the private env files, commands, backups, and smoke-test checklist.

Before testing Discord OAuth, add this exact redirect URI in the Discord Developer Portal:

```text
https://flavored-flint-hardcore.ngrok-free.dev/api/discord/oauth/callback
```
